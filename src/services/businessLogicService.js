const db = require('../config/db');
const { generateReportPDF } = require('./pdfService');
const { sendWhatsAppMessage, uploadMedia, sendWhatsAppDocument } = require('./whatsappService');
const { createTrialSubscription, activateSubscription, checkSubscription } = require('./subscriptionService');
const { t } = require('../config/i18n');
const translit = require('./transliterationService');
const { parseMessage } = require('./parserService');
const { splitIntoCommandTexts } = require('./multiCommandService');

function formatRupees(amount) {
    if (typeof amount !== 'number' || Number.isNaN(amount)) return String(amount);
    return Number.isInteger(amount) ? String(amount) : String(amount);
}

async function calculateOpeningBalanceAtDate(userId, obValue, tillDate) {
    const res = await db.query(`
        SELECT
            COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) as total_received,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
        FROM transactions
        WHERE user_id = $1 AND created_at < $2
    `, [userId, tillDate]);
    const received = parseFloat(res.rows[0].total_received);
    const expenses = parseFloat(res.rows[0].total_expenses);
    return obValue + received - expenses;
}

async function formatTransactionResponse(userId, transactionType, amount, categoryOrName, baseMessage, lang = 'english') {
    // Simply return base message without balance summary
    // Balance summary is shown in daily/reports, not in transaction responses
    return baseMessage;
}

function formatBatchEntryLine(commandObj) {
    if (!commandObj || !commandObj.command) return null;

    if (commandObj.command === 'SALE') {
        const amount = formatRupees(commandObj.amount);
        const note =
            commandObj.type === 'credit' && commandObj.customerName
                ? (commandObj.category ? `${commandObj.customerName} - ${commandObj.category}` : commandObj.customerName)
                : commandObj.category;
        return `💰 Sale: ₹${amount}${note ? ` (${note})` : ''}`;
    }

    if (commandObj.command === 'EXPENSE') {
        const amount = formatRupees(commandObj.amount);
        return `💸 Expense: ₹${amount}${commandObj.category ? ` (${commandObj.category})` : ''}`;
    }

    if (commandObj.command === 'PAYMENT') {
        const amount = formatRupees(commandObj.amount);
        return `💳 Payment: ₹${amount}${commandObj.customerName ? ` (${commandObj.customerName})` : ''}`;
    }

    return null;
}

async function processBatchEntryMessage({ user, subscriptionInfo, commandTexts }) {
    const recordedLines = [];
    const issues = [];

    for (const rawCmd of commandTexts) {
        const cmdText = (rawCmd || '').trim();
        if (!cmdText) continue;

        const parsed = parseMessage(cmdText);
        if (!parsed || !['SALE', 'EXPENSE', 'PAYMENT'].includes(parsed.command)) {
            issues.push(`❌ Invalid command: ${cmdText}`);
            continue;
        }

        try {
            const response = await processCommand(user, parsed, subscriptionInfo, cmdText, true);
            const trimmed = String(response || '').trim();

            if (trimmed.startsWith('❌') || trimmed.startsWith('⚠️')) {
                issues.push(trimmed || `❌ Failed: ${cmdText}`);
                continue;
            }

            const line = formatBatchEntryLine(parsed);
            if (line) recordedLines.push(line);
        } catch (err) {
            issues.push(`❌ ${cmdText}: ${err.message}`);
        }
    }

    if (recordedLines.length === 0) {
        return issues.length ? `❌ No entries recorded.\n\n${issues.join('\n\n')}` : '❌ No entries recorded.';
    }

    let message = `✅ Entries recorded:\n\n${recordedLines.join('\n')}`;
    if (issues.length) {
        message += `\n\n❌ Issues:\n\n${issues.join('\n\n')}`;
    }

    const lang = user.language || 'english';
    return await appendVyapaarNetMetrics(user.id, message, lang, user);
}

async function handleSetLanguage(user, lang) {
    if (user.language) {
        const currentLang = user.language || 'english';
        return currentLang === 'telugu'
            ? "❌ భాష ఒకసారి సెట్ చేసిన తర్వాత మార్చలేరు."
            : "❌ Language cannot be changed once set.";
    }

    await db.query('UPDATE users SET language = $1, language_locked = true WHERE id = $2', [lang, user.id]);
    return t(lang, 'lang_set');
}

async function handleSale(userId, commandObj, lang = 'english') {
    const { type, amount, category, customerName } = commandObj;
    let customerId = null;
    let isCredit = type === 'credit';

    if (isCredit) {
        // Find or create customer (Check both scripts)
        let custResult = await db.query(`
            SELECT id, pending_amount FROM customers 
            WHERE user_id = $1 AND (LOWER(name_telugu) = LOWER($2) OR LOWER(name_english) = LOWER($2))
        `, [userId, customerName]);

        if (custResult.rows.length === 0) {
            let nameTel, nameEng;
            if (translit.hasTelugu(customerName)) {
                nameTel = customerName;
                nameEng = translit.toEnglish(customerName);
            } else {
                nameEng = customerName;
                nameTel = translit.toTelugu(customerName);
            }
            const newCust = await db.query(`
                INSERT INTO customers (user_id, name, name_telugu, name_english, pending_amount) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id
            `, [userId, customerName, nameTel, nameEng, amount]);
            customerId = newCust.rows[0].id;
        } else {
            customerId = custResult.rows[0].id;
            await db.query('UPDATE customers SET pending_amount = pending_amount + $1 WHERE id = $2', [amount, customerId]);
        }
    }

    // Insert Sales Transaction
    await db.query(`
        INSERT INTO transactions (user_id, type, amount, category, customer_id, customer_name, is_credit)
        VALUES ($1, 'sale', $2, $3, $4, $5, $6)
    `, [userId, amount, category, customerId, customerName || null, isCredit]);

    if (!isCredit) {
        // Cash Sale: Additionally insert a 'payment' transaction to automatically balance the ledger
        await db.query(`
            INSERT INTO transactions (user_id, type, amount, customer_id, customer_name)
            VALUES ($1, 'payment', $2, $3, $4)
        `, [userId, amount, null, null]);

        const baseMsg = `✅ ${t(lang, 'sale_recorded')}${amount} (${lang === 'telugu' ? 'చెల్లించబడింది' : 'paid'})\n\n${t(lang, 'undo_hint')}`;
        return await formatTransactionResponse(userId, 'sale', amount, null, baseMsg, lang);
    } else {
        // Fetch updated pending amount
        const checkCust = await db.query('SELECT pending_amount FROM customers WHERE id = $1', [customerId]);
        const currentPending = parseFloat(checkCust.rows[0].pending_amount);
        const baseMsg = `✅ ${t(lang, 'credit_recorded')} ${customerName}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${amount}\n💰 ${lang === 'telugu' ? 'బాకీ' : 'Pending'}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${currentPending}\n\n${t(lang, 'undo_hint')}`;
        return await formatTransactionResponse(userId, 'credit_sale', amount, customerName, baseMsg, lang);
    }
}

async function handlePayment(userId, commandObj, lang = 'english') {
    const { customerName, amount } = commandObj;
    let custResult = await db.query(`
        SELECT id, pending_amount FROM customers 
        WHERE user_id = $1 AND (LOWER(name_telugu) = LOWER($2) OR LOWER(name_english) = LOWER($2))
    `, [userId, customerName]);

    if (custResult.rows.length === 0) {
        return t(lang, 'customer_not_found', { name: customerName });
    }
    const customerId = custResult.rows[0].id;
    const currentPending = parseFloat(custResult.rows[0].pending_amount);
    
    // Validation: Prevent overpayment
    if (amount > currentPending) {
        return `${t(lang, 'overpayment_alert')}\n\n*${customerName}* ${t(lang, 'pending_balance')} *Rs.${currentPending}*.\n${t(lang, 'your_entry')} *Rs.${amount}*\n\n${t(lang, 'overpayment_not_allowed')}`;
    }

    const newPending = (currentPending - amount < 0) ? 0 : (currentPending - amount);

    await db.query('UPDATE customers SET pending_amount = $1 WHERE id = $2', [newPending, customerId]);

    await db.query(`
        INSERT INTO transactions (user_id, type, amount, customer_id, customer_name)
        VALUES ($1, 'payment', $2, $3, $4)
    `, [userId, amount, customerId, customerName]);

    const baseMsg = `💰 ${t(lang, 'payment_recorded')}${amount} (${customerName})\n${lang === 'telugu' ? 'మిగిలిన బాకీ' : 'Remaining pending'}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${newPending}\n\n${t(lang, 'undo_hint')}`;
    return await formatTransactionResponse(userId, 'payment', amount, customerName, baseMsg, lang);
}

async function getLastTransaction(userId) {
    const result = await db.query(`
        SELECT * FROM transactions 
        WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '10 minutes'
        ORDER BY created_at DESC 
        LIMIT 1
    `, [userId]);
    return result.rows[0];
}

async function deleteTransaction(transaction) {
    const { id, type, amount, customer_id, is_credit } = transaction;

    if (type === 'sale' && is_credit) {
        // Revert pending amount for credit sale
        await db.query('UPDATE customers SET pending_amount = pending_amount - $1 WHERE id = $2', [amount, customer_id]);
    } else if (type === 'payment' && customer_id) {
        // Revert pending amount for payment received
        await db.query('UPDATE customers SET pending_amount = pending_amount + $1 WHERE id = $2', [amount, customer_id]);
    }

    await db.query('DELETE FROM transactions WHERE id = $1', [id]);
}

async function handleUndo(userId, lang = 'english') {
    const lastTx = await getLastTransaction(userId);
    
    if (!lastTx) {
        // Check if any transaction exists at all to provide better error message
        const anyTx = await db.query('SELECT id FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
        if (anyTx.rows.length === 0) {
            return t(lang, 'no_entry_to_undo');
        }
        return t(lang, 'no_entry_to_undo');
    }

    // Detect Cash Sale Pair (Sale + Auto-Payment)
    // A cash sale creates: 1. A 'sale' (is_credit=false) and 2. A 'payment' (customer_id=null)
    if (lastTx.type === 'payment' && lastTx.customer_id === null) {
        const precedingTxRes = await db.query(`
            SELECT * FROM transactions 
            WHERE user_id = $1 AND type = 'sale' AND is_credit = false AND amount = $2
            AND created_at >= $3 - INTERVAL '5 seconds' AND created_at <= $3
            ORDER BY created_at DESC 
            LIMIT 1
        `, [userId, lastTx.amount, lastTx.created_at]);

        if (precedingTxRes.rows.length > 0) {
            const precedingTx = precedingTxRes.rows[0];
            await deleteTransaction(lastTx);
            await deleteTransaction(precedingTx);
            return t(lang, 'undo_success');
        }
    }

    await deleteTransaction(lastTx);
    return t(lang, 'undo_success');
}

async function handleSyncBalances(userId, lang = 'english') {
    // 1. Get all customers for this user
    const customers = await db.query('SELECT id, name FROM customers WHERE user_id = $1', [userId]);

    let fixCount = 0;
    for (const customer of customers.rows) {
        // 2. Recalculate pending: Sum(sale where is_credit=true) - Sum(payment)
        const calcRes = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN type = 'sale' AND is_credit = true THEN amount ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) as real_pending
            FROM transactions
            WHERE user_id = $1 AND customer_id = $2
        `, [userId, customer.id]);

        const realPending = parseFloat(calcRes.rows[0].real_pending);
        const finalPending = realPending < 0 ? 0 : realPending;

        // 3. Update customer table
        await db.query('UPDATE customers SET pending_amount = $1 WHERE id = $2', [finalPending, customer.id]);
        fixCount++;
    }

    return `🔄 *${t(lang, 'sync_complete')}*\n${t(lang, 'sync_desc', { count: fixCount })}`;
}

async function handleSetOpeningBalance(user, amount, lang = 'english') {
    const existing = user.opening_balance;
    if (existing === null || existing === undefined) {
        // First time - save directly
        await db.query('UPDATE users SET opening_balance = $1 WHERE id = $2', [amount, user.id]);
        return t(lang, 'ob_set', { amount });
    } else {
        // Already set - ask for confirmation
        await db.query('UPDATE users SET pending_ob_amount = $1 WHERE id = $2', [amount, user.id]);
        return t(lang, 'ob_confirm_update');
    }
}

async function getVyapaarAllTimeMetrics(userId, user = null) {
    const res = await db.query(`
        SELECT type, COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = $1
        GROUP BY type
    `, [userId]);

    const totals = { sale: 0, expense: 0, payment: 0 };
    res.rows.forEach(row => {
        totals[row.type] = parseFloat(row.total);
    });

    const pendingRes = await db.query('SELECT COALESCE(SUM(pending_amount), 0) as total FROM customers WHERE user_id = $1', [userId]);
    const netPending = parseFloat(pendingRes.rows[0].total);

    // Get opening balance if not provided
    let openingBalance = null;
    if (user && (user.opening_balance !== null && user.opening_balance !== undefined)) {
        openingBalance = parseFloat(user.opening_balance);
    }

    // Calculate closing balance if OB is set
    let closingBalance = null;
    if (openingBalance !== null) {
        closingBalance = openingBalance + totals.payment - totals.expense;
    }

    return {
        netSales: totals.sale,
        netExpenses: totals.expense,
        netProfit: totals.sale - totals.expense,
        netReceived: totals.payment,
        netPending,
        openingBalance,
        closingBalance
    };
}

async function appendVyapaarNetMetrics(userId, baseMessage, lang, user = null) {
    // Fetch user if not provided
    if (!user) {
        const userRes = await db.query('SELECT opening_balance FROM users WHERE id = $1', [userId]);
        user = userRes.rows[0] || {};
    }

    const metrics = await getVyapaarAllTimeMetrics(userId, user);
    const symbol = lang === 'telugu' ? 'రూ.' : 'Rs.';

    // Clean, compact format for Net Metrics
    let netStr = `\n\n`;

    // Opening Balance (if set)
    if (metrics.openingBalance !== null) {
        const obFormatted = parseFloat(metrics.openingBalance).toFixed(2).replace(/\.00$/, '');
        netStr += `${t(lang, 'report_opening_balance')}: ${symbol}${obFormatted}\n`;
    }

    netStr += `${t(lang, 'report_sales')}: ${symbol}${parseFloat(metrics.netSales).toFixed(2).replace(/\.00$/, '')}\n`;
    netStr += `${t(lang, 'report_expenses')}: ${symbol}${parseFloat(metrics.netExpenses).toFixed(2).replace(/\.00$/, '')}\n`;
    netStr += `${t(lang, 'report_profit')}: ${symbol}${parseFloat(metrics.netProfit).toFixed(2).replace(/\.00$/, '')}\n`;
    netStr += `${t(lang, 'report_received')}: ${symbol}${parseFloat(metrics.netReceived).toFixed(2).replace(/\.00$/, '')}\n`;
    netStr += `\n${t(lang, 'report_total_pending')}: ${symbol}${parseFloat(metrics.netPending).toFixed(2).replace(/\.00$/, '')}\n`;

    // Closing Balance (if OB is set)
    if (metrics.closingBalance !== null) {
        const cbFormatted = parseFloat(metrics.closingBalance).toFixed(2).replace(/\.00$/, '');
        netStr += `${t(lang, 'report_closing_balance')}: ${symbol}${cbFormatted}`;
    }

    return baseMessage + netStr;
}

async function getReportData(userId, startDate, endDate) {
    // 1. Core Totals (Sales, Expenses, Payments)
    const result = await db.query(`
        SELECT 
            type, 
            COALESCE(SUM(amount), 0) as total 
        FROM transactions 
        WHERE user_id = $1 
        AND created_at >= $2 AND created_at < $3
        GROUP BY type
    `, [userId, startDate, endDate]);

    const totals = { sale: 0, expense: 0, payment: 0 };
    result.rows.forEach(row => {
        totals[row.type] = parseFloat(row.total);
    });

    // 2. Received Breakdown (Individual customer payments in this period)
    const receivedBreakdown = await db.query(`
        SELECT 
            t.customer_name as original_name,
            c.name_telugu,
            c.name_english,
            SUM(t.amount) as total_paid, 
            DATE(t.created_at) as payment_date 
        FROM transactions t
        LEFT JOIN customers c ON t.customer_id = c.id
        WHERE t.user_id = $1 AND t.type = 'payment' AND t.customer_id IS NOT NULL 
        AND t.created_at >= $2 AND t.created_at < $3
        GROUP BY t.customer_name, c.name_telugu, c.name_english, DATE(t.created_at)
        ORDER BY payment_date DESC, total_paid DESC
    `, [userId, startDate, endDate]);

    // 3. Overall Market Health (Current Total Pending)
    const totalPendingRes = await db.query(`SELECT COALESCE(SUM(pending_amount), 0) as total FROM customers WHERE user_id = $1`, [userId]);
    const totalPending = parseFloat(totalPendingRes.rows[0].total);

    // 4. Top Pending Customers (Current)
    const topPendingResult = await db.query(`
        SELECT name, name_telugu, name_english, pending_amount FROM customers 
        WHERE user_id = $1 AND pending_amount > 0
        ORDER BY pending_amount DESC
        LIMIT 5
    `, [userId]);

    return {
        totals,
        receivedBreakdown: receivedBreakdown.rows,
        totalPending,
        topPendingList: topPendingResult.rows
    };
}

function formatReportText(titleKeyOrText, data, lang = 'english', insights = null, openingBalance = null, closingBalance = null) {
    const { totals, receivedBreakdown, totalPending, topPendingList } = data;
    const profit = totals.sale - totals.expense;

    const title = t(lang, titleKeyOrText);

    if (totals.sale === 0 && totals.expense === 0 && totals.payment === 0) {
        return `📊 *${title}*\n${t(lang, 'report_no_data')}`;
    }

    let reportStr = `📊 *${title}*\n\n`;

    // Opening Balance
    if (openingBalance !== null && openingBalance !== undefined) {
        reportStr += `${t(lang, 'report_opening_balance')}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${parseFloat(openingBalance)}\n`;
    }

    reportStr += `${t(lang, 'report_sales')}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${totals.sale}\n`;
    reportStr += `${t(lang, 'report_expenses')}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${totals.expense}\n`;
    reportStr += `${t(lang, 'report_profit')}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${profit}\n`;
    reportStr += `${t(lang, 'report_received')}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${totals.payment}\n`;

    if (receivedBreakdown.length > 0) {
        receivedBreakdown.forEach(p => {
            const dateStr = formatDateReport(new Date(p.payment_date));
            const displayName = lang === 'telugu' ? (p.name_telugu || p.original_name) : (p.name_english || p.original_name);
            reportStr += `  ↳ ${displayName}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${parseFloat(p.total_paid)} (${dateStr})\n`;
        });
    }
    reportStr += `\n`;

    reportStr += `${t(lang, 'report_total_pending')}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${totalPending}\n`;

    // Closing Balance
    if (closingBalance !== null && closingBalance !== undefined) {
        reportStr += `${t(lang, 'report_closing_balance')}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${parseFloat(closingBalance)}\n`;
    }

    if (topPendingList.length > 0) {
        reportStr += `\n*${t(lang, 'report_top_pending')}*\n`;
        topPendingList.forEach(c => {
            const displayName = lang === 'telugu' ? (c.name_telugu || c.name) : (c.name_english || c.name);
            reportStr += `- ${displayName}: ${lang === 'telugu' ? 'రూ.' : 'Rs.'}${parseFloat(c.pending_amount)}\n`;
        });
    }

    if (insights) {
        reportStr += `\n📈 *${t(lang, 'insights_title')}:*\n${insights}`;
    }

    return reportStr;
}

/**
 * Formats a date to "19th March, 2026"
 */
function formatDateReport(date) {
    const day = date.getDate();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    const getOrdinal = (n) => {
        if (n > 3 && n < 21) return 'th';
        switch (n % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    };

    return `${day}${getOrdinal(day)} ${month}, ${year}`;
}

function generateInsights(data, prevData, totalPending) {
    const insights = [];
    const profit = data.sale - data.expense;

    // A. Sales Trend
    if (prevData) {
        if (data.sale > prevData.sale) {
            insights.push("🔥 Sales increased compared to last period");
        } else if (data.sale < prevData.sale) {
            insights.push("📉 Sales decreased compared to last period");
        }
    }

    // B. Expense Alert
    if (data.sale > 0 && data.expense > (data.sale * 0.5)) {
        insights.push("⚠️ Expenses are high (>50% of sales)");
    }

    // C. Pending Alert
    if (data.sale > 0 && totalPending > (data.sale * 0.3)) {
        insights.push("💰 Pending is high, collect payments");
    }

    // D. Positive Insight
    if (profit > 0 && data.sale > 0) {
        insights.push("✅ Good profit this period");
    }

    if (insights.length === 0) {
        insights.push("📈 Keep tracking to see more insights!");
    }

    return insights.slice(0, 4).join("\n");
}

function generateInsightsLocalized(data, prevData, totalPending, lang = 'english') {
    const insights = [];
    const profit = data.sale - data.expense;

    if (prevData) {
        if (data.sale > prevData.sale) insights.push(t(lang, 'insight_sales_up'));
        else if (data.sale < prevData.sale) insights.push(t(lang, 'insight_sales_down'));
    }

    if (data.sale > 0 && data.expense > (data.sale * 0.5)) insights.push(t(lang, 'insight_expenses_high'));
    if (data.sale > 0 && totalPending > (data.sale * 0.3)) insights.push(t(lang, 'insight_pending_high'));
    if (profit > 0 && data.sale > 0) insights.push(t(lang, 'insight_profit_good'));
    if (insights.length === 0) insights.push(t(lang, 'insight_keep_tracking'));

    return insights.slice(0, 4).join("\n");
}

async function handleWeeklyReport(userId, user, lang = 'english') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    const fourteenDaysAgo = new Date(today.getTime() - (14 * 24 * 60 * 60 * 1000));

    const data = await getReportData(userId, sevenDaysAgo, new Date());
    const prevDataResult = await db.query(`
        SELECT type, COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 GROUP BY type
    `, [userId, fourteenDaysAgo, sevenDaysAgo]);

    const prevTotals = { sale: 0, expense: 0, payment: 0 };
    prevDataResult.rows.forEach(row => prevTotals[row.type] = parseFloat(row.total));

    const insights = generateInsightsLocalized(data.totals, prevTotals, data.totalPending, lang);

    // Calculate Opening Balance and Closing Balance
    let openingBalance = null;
    let closingBalance = null;
    if (user && (user.opening_balance !== null && user.opening_balance !== undefined)) {
        const obValue = parseFloat(user.opening_balance);
        openingBalance = await calculateOpeningBalanceAtDate(userId, obValue, sevenDaysAgo);
        closingBalance = openingBalance + data.totals.payment - data.totals.expense;
    }

    return formatReportText('report_title_weekly', data, lang, insights, openingBalance, closingBalance);
}

async function handleMonthlyReport(userId, user, lang = 'english') {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const data = await getReportData(userId, startOfMonth, new Date());
    const prevDataResult = await db.query(`
        SELECT type, COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 GROUP BY type
    `, [userId, startOfPrevMonth, startOfMonth]);

    const prevTotals = { sale: 0, expense: 0, payment: 0 };
    prevDataResult.rows.forEach(row => prevTotals[row.type] = parseFloat(row.total));

    const insights = generateInsightsLocalized(data.totals, prevTotals, data.totalPending, lang);

    // Calculate Opening Balance and Closing Balance
    let openingBalance = null;
    let closingBalance = null;
    if (user && (user.opening_balance !== null && user.opening_balance !== undefined)) {
        const obValue = parseFloat(user.opening_balance);
        openingBalance = await calculateOpeningBalanceAtDate(userId, obValue, startOfMonth);
        closingBalance = openingBalance + data.totals.payment - data.totals.expense;
    }

    return formatReportText('report_title_monthly', data, lang, insights, openingBalance, closingBalance);
}

async function handleCustomReport(userId, user, dateStr, lang = 'english') {
    // Parse in local IST time by appending T00:00:00
    const startOfDay = new Date(dateStr + 'T00:00:00');
    const endOfDay = new Date(startOfDay.getTime() + (24 * 60 * 60 * 1000));

    const data = await getReportData(userId, startOfDay, endOfDay);

    // Calculate Opening Balance and Closing Balance
    let openingBalance = null;
    let closingBalance = null;
    if (user && (user.opening_balance !== null && user.opening_balance !== undefined)) {
        const obValue = parseFloat(user.opening_balance);
        openingBalance = await calculateOpeningBalanceAtDate(userId, obValue, startOfDay);
        closingBalance = openingBalance + data.totals.payment - data.totals.expense;
    }

    return formatReportText('report_title_custom', data, lang, null, openingBalance, closingBalance);
}

async function handleYearlyReport(userId, user, lang = 'english') {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1);

    const data = await getReportData(userId, startOfYear, new Date());
    const prevDataResult = await db.query(`
        SELECT type, COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 GROUP BY type
    `, [userId, startOfPrevYear, startOfYear]);

    const prevTotals = { sale: 0, expense: 0, payment: 0 };
    prevDataResult.rows.forEach(row => prevTotals[row.type] = parseFloat(row.total));

    const insights = generateInsightsLocalized(data.totals, prevTotals, data.totalPending, lang);

    // Calculate Opening Balance and Closing Balance
    let openingBalance = null;
    let closingBalance = null;
    if (user && (user.opening_balance !== null && user.opening_balance !== undefined)) {
        const obValue = parseFloat(user.opening_balance);
        openingBalance = await calculateOpeningBalanceAtDate(userId, obValue, startOfYear);
        closingBalance = openingBalance + data.totals.payment - data.totals.expense;
    }

    return formatReportText('report_title_yearly', data, lang, insights, openingBalance, closingBalance);
}

async function handlePdfReport(userId, phoneNumber, type, lang = 'english', dateStr = null) {
    let startDate, endDate, title, filename;
    const now = new Date();

    if (type === 'weekly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        endDate = new Date();
        title = t(lang, 'report_title_weekly');
        filename = `weekly_report_${Date.now()}.pdf`;
    } else if (type === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
        title = t(lang, 'report_title_monthly');
        filename = `monthly_report_${Date.now()}.pdf`;
    } else if (type === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date();
        title = t(lang, 'report_title_yearly');
        filename = `yearly_report_${Date.now()}.pdf`;
    } else if (type === 'custom' && dateStr) {
        startDate = new Date(dateStr);
        endDate = new Date(startDate.getTime() + (24 * 60 * 60 * 1000));
        title = t(lang, 'report_title_custom', { date: dateStr });
        filename = `report_${dateStr}_${Date.now()}.pdf`;
    }

    const data = await getReportData(userId, startDate, endDate);
    const transactions = await db.query(`
        SELECT created_at, type, amount, category, customer_name 
        FROM transactions 
        WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
        ORDER BY created_at DESC
    `, [userId, startDate, endDate]);

    if (transactions.rows.length === 0) {
        await sendWhatsAppMessage(phoneNumber, t(lang, 'pdf_no_data'));
        return;
    }

    const pdfPath = await generateReportPDF(data.totals, transactions.rows, title, filename, lang);
    const mediaId = await uploadMedia(pdfPath);
    
    if (mediaId) {
        await sendWhatsAppDocument(phoneNumber, mediaId, filename);
    } else {
        await sendWhatsAppMessage(phoneNumber, "❌ Failed to generate or upload PDF report.");
    }
}

function checkUserPlanAccess(planType, commandObj, lang = 'english') {
    const cmd = commandObj.command;
    const isProFeature = (['WEEKLY', 'MONTHLY', 'YEARLY'].includes(cmd) || (commandObj.isPdf && cmd !== 'DAILY'));

    // Trial and Pro have access to everything
    if (planType === 'pro' || planType === 'trial') {
        return { allowed: true };
    }

    // Standard Plan Access
    if (planType === 'standard' || planType === 'none') {
        if (isProFeature) {
            const upiId = process.env.UPI_ID || '9000861903@ybl';
            return {
                allowed: false,
                message: `${t(lang, 'upgrade_pro_title')}\n\n` +
                         `${t(lang, 'get_features')}\n` +
                         `${t(lang, 'pro_features')}\n\n` +
                         `${t(lang, 'pay_amount')}\n` +
                         `upi://pay?pa=${upiId}&pn=VyapaarIQ\n\n` +
                         `${t(lang, 'or_pay_using')}\n` +
                         `${t(lang, 'upi_id_label')} ${upiId}\n` +
                         `${t(lang, 'mobile_label')} ${upiId.split('@')[0]}\n\n` +
                         `${t(lang, 'after_pay_send')}\n` +
                         `*PAID pro*`
            };
        }
    }

    return { allowed: true };
}

async function handlePaidMessage(user, commandObj, lang = 'english') {
    const { planType } = commandObj;
    if (planType !== 'pro') {
        return t(lang, 'paid_invalid_plan');
    }

    const adminPhone = (process.env.ADMIN_PHONE || '').trim();
    if (adminPhone) {
        const now = new Date();
        const adminMsg =
            `💳 PAID Received (VyapaarIQ)\n` +
            `User: ${user.phone_number}\n` +
            `Plan: ${planType.toUpperCase()}\n` +
            `Time: ${now.toLocaleString()}\n\n` +
            `Activate:\nACTIVATE ${user.phone_number} ${planType}`;
        await sendWhatsAppMessage(adminPhone, adminMsg);
    }

    return `${t(lang, 'payment_notified_title')}\n\n` +
           `Plan: *${planType.toUpperCase()}*\n\n` +
           `${t(lang, 'payment_notified_desc')}`;
}

async function handleAdminActivateCommand(user, commandObj) {
    // 1. Admin Security Check
    const adminPhone = (process.env.ADMIN_PHONE || '').trim();
    if (user.phone_number !== adminPhone) {
        console.log(`[AUTH FAILED] User ${user.phone_number} tried to use admin command. Expected: ${adminPhone}`);
        return "❌ Unauthorized command";
    }

    // 2. Format Validation
    const { targetPhone, planType } = commandObj;
    if (!targetPhone || planType !== 'pro') {
        return "❌ Invalid command\n\n👉 Use:\nACTIVATE <phone_number> pro\n\nExample:\nACTIVATE 919000xxxxxx pro";
    }

    // 3. User Existence Check
    let targetUserRes = await db.query('SELECT id FROM users WHERE phone_number = $1', [targetPhone]);
    let targetUserId;
    if (targetUserRes.rows.length === 0) {
        // Preserve existing admin behavior: allow activating even if the user hasn't onboarded yet.
        // Create a minimal user record so subscriptions can be activated and messages can be sent.
        const inserted = await db.query(
            'INSERT INTO users (phone_number) VALUES ($1) RETURNING id',
            [targetPhone]
        );
        targetUserId = inserted.rows[0].id;
        await db.query('DELETE FROM onboarding_leads WHERE phone_number = $1', [targetPhone]);
    } else {
        targetUserId = targetUserRes.rows[0].id;
    }

    // 4. Duplicate Protection (Plan logic extension handled by service, but we notify if already active)
    const existingSub = await checkSubscription(targetUserId);
    let statusPrefix = "activated";
    if (existingSub && existingSub.status === 'active') {
        statusPrefix = "extended";
        // Optionally inform admin it was an extension
    }

    // 5. Activation Logic
    try {
        const newEndDate = await activateSubscription(targetUserId, planType);
        const formattedDate = newEndDate.toLocaleDateString('en-GB'); // DD/MM/YYYY

        const targetLangRes = await db.query('SELECT language FROM users WHERE id = $1', [targetUserId]);
        const targetLang = targetLangRes.rows[0]?.language || 'english';

        // 6. Notify Target User
        const userMsg =
            `${t(targetLang, 'sub_activated_title', { status: statusPrefix })}\n\n` +
            `${t(targetLang, 'sub_plan_label')}: *${planType.toUpperCase()}*\n` +
            `${t(targetLang, 'sub_valid_till_label')}: *${formattedDate}*\n\n` +
            `${t(targetLang, 'sub_thanks')}`;
        await sendWhatsAppMessage(targetPhone, userMsg);

        // 7. Response to Admin
        return `✅ *Success!*\nUser ${targetPhone} has been ${statusPrefix} for ${planType.toUpperCase()} plan until ${formattedDate}.`;
    } catch (error) {
        console.error('Activation Error:', error);
        return "❌ Internal error during activation.";
    }
}

function getWelcomeMessage(lang = 'english') {
    return `${t(lang, 'welcome_title')}\n` +
           `${t(lang, 'welcome_subtitle')}\n\n` +
           `${t(lang, 'welcome_intro')}\n\n` +
           `${t(lang, 'cat_opening_balance')}\n` +
           `• ${t(lang, 'cmd_set_opening_balance')}\n` +
           `${t(lang, 'hint_opening_balance')}\n\n` +
           `${t(lang, 'cat_sales')}\n` +
           `• ${t(lang, 'cmd_cash_sale')}\n` +
           `• ${t(lang, 'cmd_credit_sale')}\n\n` +
           `${t(lang, 'cat_expenses')}\n` +
           `• ${t(lang, 'cmd_expense')}\n\n` +
           `${t(lang, 'cat_payments')}\n` +
           `• ${t(lang, 'cmd_payment')}\n\n` +
           `${t(lang, 'cat_reports')}\n` +
           `• ${t(lang, 'cmd_daily')}\n` +
           `• ${t(lang, 'cmd_weekly')}\n` +
           `• ${t(lang, 'cmd_monthly')}\n` +
           `• ${t(lang, 'cmd_yearly')}\n` +
           `• ${t(lang, 'cmd_custom_report')}\n` +
           `${t(lang, 'hint_pdf')}\n\n` +
           `${t(lang, 'cat_control')}\n` +
           `• ${t(lang, 'cmd_undo')}\n` +
           `• ${t(lang, 'cmd_sync')}\n\n` +
           `${t(lang, 'multi_cmd_hint')}\n\n` +
           `--------------------------\n` +
           `${t(lang, 'footer')}`;
}

function getOnboardingStartPrompt() {
    return "Please type *START* to begin.\nదయచేసి ప్రారంభించడానికి *START* టైప్ చేయండి.";
}

function getLanguageChoicePrompt() {
    return (
        "*Choose your language (Reply with 1 or 2):*\n" +
        "1) English\n" +
        "2) తెలుగు\n\n" +
        "(*Once set, language cannot be changed*)"
    );
}

function getLanguageConfirmPrompt(pendingLang) {
    const label = pendingLang === 'telugu' ? 'తెలుగు' : 'English';
    return (
        `You selected *${label}*.\n` +
        "Confirm? Reply *YES* or *NO*.\n\n" +
        "Note: Once set, language cannot be changed."
    );
}

async function processCommand(user, commandObj, subscriptionInfo = {}, rawText = '', isInternal = false) {
    const { status, planType, paymentLink } = subscriptionInfo;

    let currentUser = user;
    if (user && user.id) {
        const userRes = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
        currentUser = userRes.rows[0] || user;
    }

    const text = (rawText || '').trim();
    const upper = (commandObj && commandObj.command === 'START') ? 'START' : text.toUpperCase();

    // Onboarding (language not set yet)
    if (!currentUser.language) {
        // For brand-new users, we keep onboarding state in onboarding_leads (no users row yet).
        const phoneNumber = currentUser.phone_number;
        if (!phoneNumber) {
            return getOnboardingStartPrompt();
        }

        let stage = null;
        let pendingFromLead = null;

        if (!currentUser.id) {
            const leadRes = await db.query(
                'SELECT onboarding_stage, onboarding_pending_language FROM onboarding_leads WHERE phone_number = $1',
                [phoneNumber]
            );
            if (leadRes.rows.length > 0) {
                stage = leadRes.rows[0].onboarding_stage || null;
                pendingFromLead = leadRes.rows[0].onboarding_pending_language || null;
            }
        } else {
            stage = currentUser.onboarding_stage || null;
            pendingFromLead = currentUser.onboarding_pending_language || null;
        }

        // Force START as the first step
        if (!stage) {
            if (upper !== 'START') return getOnboardingStartPrompt();
            if (!currentUser.id) {
                await db.query(`
                    INSERT INTO onboarding_leads (phone_number, onboarding_stage, onboarding_pending_language)
                    VALUES ($1, 'choose_language', NULL)
                    ON CONFLICT (phone_number) DO UPDATE
                    SET onboarding_stage = 'choose_language', onboarding_pending_language = NULL
                `, [phoneNumber]);
            } else {
                await db.query(
                    "UPDATE users SET onboarding_stage = 'choose_language', onboarding_pending_language = NULL WHERE id = $1",
                    [currentUser.id]
                );
            }
            return getLanguageChoicePrompt();
        }

        if (stage === 'choose_language') {
            if (upper === 'START') return getLanguageChoicePrompt();
            if (text === '1' || text === '2') {
                const pendingLang = text === '1' ? 'english' : 'telugu';
                if (!currentUser.id) {
                    await db.query(
                        "UPDATE onboarding_leads SET onboarding_stage = 'confirm_language', onboarding_pending_language = $1 WHERE phone_number = $2",
                        [pendingLang, phoneNumber]
                    );
                } else {
                    await db.query(
                        "UPDATE users SET onboarding_stage = 'confirm_language', onboarding_pending_language = $1 WHERE id = $2",
                        [pendingLang, currentUser.id]
                    );
                }
                return getLanguageConfirmPrompt(pendingLang);
            }
            return getLanguageChoicePrompt();
        }

        if (stage === 'confirm_language') {
            const pending = pendingFromLead;
            if (!pending) {
                if (!currentUser.id) {
                    await db.query(
                        "UPDATE onboarding_leads SET onboarding_stage = 'choose_language', onboarding_pending_language = NULL WHERE phone_number = $1",
                        [phoneNumber]
                    );
                } else {
                    await db.query(
                        "UPDATE users SET onboarding_stage = 'choose_language' WHERE id = $1",
                        [currentUser.id]
                    );
                }
                return getLanguageChoicePrompt();
            }

            if (upper === 'YES') {
                let ensuredUser = currentUser;
                if (!currentUser.id) {
                    const insertUser = await db.query(
                        'INSERT INTO users (phone_number) VALUES ($1) RETURNING *',
                        [phoneNumber]
                    );
                    ensuredUser = insertUser.rows[0];
                    await createTrialSubscription(ensuredUser.id);
                    await db.query('DELETE FROM onboarding_leads WHERE phone_number = $1', [phoneNumber]);
                }

                await db.query(
                    "UPDATE users SET language = $1, language_locked = true, onboarding_stage = NULL, onboarding_pending_language = NULL WHERE id = $2",
                    [pending, ensuredUser.id]
                );
                return getWelcomeMessage(pending);
            }
            if (upper === 'NO') {
                if (!currentUser.id) {
                    await db.query(
                        "UPDATE onboarding_leads SET onboarding_stage = 'choose_language', onboarding_pending_language = NULL WHERE phone_number = $1",
                        [phoneNumber]
                    );
                } else {
                    await db.query(
                        "UPDATE users SET onboarding_stage = 'choose_language', onboarding_pending_language = NULL WHERE id = $1",
                        [currentUser.id]
                    );
                }
                return getLanguageChoicePrompt();
            }

            return getLanguageConfirmPrompt(pending);
        }

        // Unknown stage fallback
        if (!currentUser.id) {
            await db.query('DELETE FROM onboarding_leads WHERE phone_number = $1', [phoneNumber]);
        } else {
            await db.query(
                "UPDATE users SET onboarding_stage = NULL, onboarding_pending_language = NULL WHERE id = $1",
                [currentUser.id]
            );
        }
        return getOnboardingStartPrompt();
    }

    const lang = currentUser.language || 'english';

    // Handle YES/NO for pending OB update (checked early, before other commands)
    if (upper === 'YES' && currentUser.pending_ob_amount !== null && currentUser.pending_ob_amount !== undefined) {
        const newOb = parseFloat(currentUser.pending_ob_amount);
        await db.query('UPDATE users SET opening_balance = $1, pending_ob_amount = NULL WHERE id = $2', [newOb, currentUser.id]);
        return t(lang, 'ob_updated', { amount: newOb });
    }
    if (upper === 'NO' && currentUser.pending_ob_amount !== null && currentUser.pending_ob_amount !== undefined) {
        await db.query('UPDATE users SET pending_ob_amount = NULL WHERE id = $1', [currentUser.id]);
        return t(lang, 'ob_confirm_cancelled');
    }

    // Multi-command support (only for entry commands). Keeps single-command behavior unchanged.
    // Primary separator: newline, secondary: comma (when it looks like a new command).
    if (status !== 'expired') {
        const commandTexts = splitIntoCommandTexts(text);
        if (commandTexts.length > 1) {
            const hasEntry = commandTexts.some((cmdText) => {
                const parsed = parseMessage((cmdText || '').trim());
                return parsed && ['SALE', 'EXPENSE', 'PAYMENT'].includes(parsed.command);
            });

            if (hasEntry) {
                return await processBatchEntryMessage({ user: currentUser, subscriptionInfo, commandTexts });
            }
        }
    }

    if (!commandObj) {
        return getWelcomeMessage(lang);
    }

    // If language is already set, START just shows the welcome/commands.
    if (commandObj.command === 'START') {
        return getWelcomeMessage(lang);
    }

    // 1. Language Enforcement (skip for system/admin/payment notifications and OB)
    if (!['SET_LANG', 'WELCOME', 'PAID', 'ACTIVATE', 'SET_OB'].includes(commandObj.command)) {
        if (lang === 'telugu' && commandObj.sourceLang === 'english') {
            return t('telugu', 'err_use_telugu');
        }
        if (lang === 'english' && commandObj.sourceLang === 'telugu') {
            return t('english', 'err_use_english');
        }
    }

    // 2. Always allow PAID (to notify admin) and WELCOME
    if (commandObj.command === 'PAID') {
        return await handlePaidMessage(user, commandObj, lang);
    }
    
    if (commandObj.command === 'WELCOME') {
        return getWelcomeMessage(lang);
    }

    if (commandObj.command === 'SET_LANG') {
        return await handleSetLanguage(currentUser, commandObj.lang);
    }

    if (commandObj.command === 'SET_OB') {
        return await handleSetOpeningBalance(currentUser, commandObj.amount, lang);
    }

    // Always allow ACTIVATE for admin (should work even if the admin's own subscription is expired).
    if (commandObj.command === 'ACTIVATE') {
        return await handleAdminActivateCommand(user, commandObj);
    }

    // 2. Handle Expired State (Block other commands)
    if (status === 'expired') {
        const upiId = process.env.UPI_ID || '9000861903@ybl';
        return `${t(lang, 'trial_ended_title')}\n\n` +
               `${t(lang, 'data_safe')}\n\n` +
               `${t(lang, 'intro_pricing_block')}\n\n` +
               `${t(lang, 'pro_plan_name')} – ${t(lang, 'pro_price')}\n` +
               `${t(lang, 'pro_features')}\n\n` +
               `${t(lang, 'pay_via_upi')}\n` +
               `upi://pay?pa=${upiId}&pn=VyapaarIQ\n\n` +
               `${t(lang, 'or_pay_using')}\n` +
               `${t(lang, 'upi_id_label')} ${upiId}\n` +
               `${t(lang, 'mobile_label')} ${upiId.split('@')[0]}\n\n` +
               `${t(lang, 'after_pay_send')}\n` +
               `${t(lang, 'paid_msg_example')}`;
    }

    // 3. Feature Access Control
    const access = checkUserPlanAccess(planType, commandObj, lang);
    if (!access.allowed) {
        return access.message;
    }

    const userId = user.id;

    // Check if OB is set before allowing transactions (SALE, EXPENSE, PAYMENT)
    if (['SALE', 'EXPENSE', 'PAYMENT'].includes(commandObj.command)) {
        if (currentUser.opening_balance === null || currentUser.opening_balance === undefined) {
            return t(lang, 'ob_missing');
        }
    }

    let response;

    if (commandObj.command === 'SALE') {
        response = await handleSale(userId, commandObj, lang);
    } else if (commandObj.command === 'EXPENSE') {
        const { amount, category } = commandObj;
        await db.query(`
            INSERT INTO transactions (user_id, type, amount, category)
            VALUES ($1, 'expense', $2, $3)
        `, [userId, amount, category]);
        const baseMsg = `✅ ${t(lang, 'expense_recorded')}${amount}${category ? ` (${category})` : ''}\n\n${t(lang, 'undo_hint')}`;
        response = await formatTransactionResponse(userId, 'expense', amount, category, baseMsg, lang);
    } else if (commandObj.command === 'PAYMENT') {
        response = await handlePayment(userId, commandObj, lang);
    } else if (commandObj.command === 'UNDO') {
        response = await handleUndo(userId, lang);
    } else if (commandObj.command === 'SYNC') {
        response = await handleSyncBalances(userId, lang);
    } else if (commandObj.command === 'WEEKLY') {
        if (commandObj.isPdf) {
            handlePdfReport(userId, user.phone_number, 'weekly', lang);
            response = lang === 'telugu' ? "⏳ వారపు PDF నివేదిక తయారవుతోంది..." : "⏳ Generating Weekly PDF report...";
        } else {
            response = await handleWeeklyReport(userId, currentUser, lang);
        }
    } else if (commandObj.command === 'MONTHLY') {
        if (commandObj.isPdf) {
            handlePdfReport(userId, user.phone_number, 'monthly', lang);
            response = lang === 'telugu' ? "⏳ నెలవారీ PDF నివేదిక తయారవుతోంది..." : "⏳ Generating Monthly PDF report...";
        } else {
            response = await handleMonthlyReport(userId, currentUser, lang);
        }
    } else if (commandObj.command === 'YEARLY') {
        if (commandObj.isPdf) {
            handlePdfReport(userId, user.phone_number, 'yearly', lang);
            response = lang === 'telugu' ? "⏳ వార్షిక PDF నివేదిక తయారవుతోంది..." : "⏳ Generating Yearly PDF report...";
        } else {
            response = await handleYearlyReport(userId, currentUser, lang);
        }
    } else if (commandObj.command === 'ACTIVATE') {
        response = await handleAdminActivateCommand(user, commandObj);
    } else if (commandObj.command === 'DAILY') {
        if (commandObj.date) {
            if (commandObj.isPdf) {
                handlePdfReport(userId, user.phone_number, 'custom', lang, commandObj.date);
                response = lang === 'telugu'
                    ? `⏳ ${commandObj.date} PDF నివేదిక తయారవుతోంది...`
                    : `⏳ Generating PDF report for ${commandObj.date}...`;
            } else {
                response = await handleCustomReport(userId, currentUser, commandObj.date, lang);
            }
        } else if (commandObj.isPdf) {
            handlePdfReport(userId, user.phone_number, 'custom', lang, new Date().toISOString().split('T')[0]);
            response = lang === 'telugu' ? "⏳ డైలీ PDF నివేదిక తయారవుతోంది..." : "⏳ Generating Daily PDF report...";
        } else {
            // Today's summary (Standardized)
            const startOfToday = new Date();
            startOfToday.setHours(0,0,0,0);
            const data = await getReportData(userId, startOfToday, new Date());

            // Calculate Opening Balance and Closing Balance for today
            let openingBalance = null;
            let closingBalance = null;
            if (currentUser.opening_balance !== null && currentUser.opening_balance !== undefined) {
                const obValue = parseFloat(currentUser.opening_balance);
                openingBalance = await calculateOpeningBalanceAtDate(userId, obValue, startOfToday);
                closingBalance = openingBalance + data.totals.payment - data.totals.expense;
            }

            response = formatReportText('report_title_today', data, lang, null, openingBalance, closingBalance);
        }
    } else {
        response = "❌ Feature not implemented.";
    }

    if (!isInternal && response && ['SALE', 'EXPENSE', 'PAYMENT', 'UNDO'].includes(commandObj.command)) {
        return await appendVyapaarNetMetrics(userId, response, lang, currentUser);
    }
    return response;
}

module.exports = {
    processCommand,
    handleSale,
    handlePayment,
    handleUndo,
    handleWeeklyReport,
    handleMonthlyReport,
    handleYearlyReport,
    handleCustomReport,
    handlePdfReport,
    getVyapaarAllTimeMetrics,
    appendVyapaarNetMetrics,
    handleSetOpeningBalance,
    calculateOpeningBalanceAtDate,
    formatTransactionResponse
};
