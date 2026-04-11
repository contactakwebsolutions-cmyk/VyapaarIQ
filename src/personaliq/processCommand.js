const db = require('../config/db');
const { parsePersonalMessage } = require('./parserService');
const { personalText } = require('./messages');
const { ensurePersonalUser, addTransaction, getPersonalSummary, getLastTransaction, deleteTransaction, appendPersonalNetMetrics } = require('./personalLogicService');
const { createTrialSubscription, checkSubscription, activateSubscription } = require('./subscriptionService');
const { sendWhatsAppMessage, uploadMedia, sendWhatsAppDocument } = require('../services/whatsappService');
const { generatePersonalReportPDF } = require('./pdfService');
const { splitIntoCommandTexts } = require('../services/multiCommandService');

function formatRupees(amount) {
    if (typeof amount !== 'number' || Number.isNaN(amount)) return String(amount);
    return Number.isInteger(amount) ? String(amount) : String(amount);
}

function getPaywallMessage(lang) {
    const upiId = process.env.UPI_ID || '9000861903@ybl';
    const mobile = upiId.includes('@') ? upiId.split('@')[0] : upiId;
    return [
        personalText(lang, 'pay_title'),
        '',
        personalText(lang, 'pay_intro_pricing_block'),
        '',
        personalText(lang, 'pay_choose'),
        personalText(lang, 'pay_pro'),
        '',
        personalText(lang, 'pay_via_upi'),
        `upi://pay?pa=${upiId}&pn=VyapaarIQ`,
        '',
        personalText(lang, 'or_pay_using'),
        `${personalText(lang, 'upi_id_label')} ${upiId}`,
        `${personalText(lang, 'mobile_label')} ${mobile}`,
        '',
        personalText(lang, 'pay_after')
    ].join('\n');
}

function isProAllowed(period) {
    return ['weekly', 'monthly', 'yearly'].includes(period);
}

async function ensureTrialIfMissing(personalUserId) {
    const latestRes = await db.query(
        'SELECT * FROM personaliq_subscriptions WHERE personaliq_user_id = $1 ORDER BY end_date DESC LIMIT 1',
        [personalUserId]
    );

    if (latestRes.rows.length === 0) {
        await createTrialSubscription(personalUserId);
        return await checkSubscription(personalUserId);
    }

    const latest = latestRes.rows[0];
    if (latest.status === 'expired') return latest;

    return await checkSubscription(personalUserId);
}

async function handlePaid({ lang, fromPhoneNumber, planType }) {
    const adminPhone = (process.env.ADMIN_PHONE || '').trim();
    if (adminPhone && fromPhoneNumber && planType === 'pro') {
        const now = new Date();
        const adminMsg =
            `💳 PAID Received (PersonalIQ)\n` +
            `User: ${fromPhoneNumber}\n` +
            `Plan: ${planType.toUpperCase()}\n` +
            `Time: ${now.toLocaleString()}\n\n` +
            `Activate:\nPACTIVATE ${fromPhoneNumber} ${planType}`;
        await sendWhatsAppMessage(adminPhone, adminMsg);
    }

    return personalText(lang, 'paid_received');
}

function getPeriodTitle(period, lang) {
    if (period === 'weekly') return lang === 'telugu' ? 'వారపు నివేదిక' : 'Weekly Report';
    if (period === 'monthly') return lang === 'telugu' ? 'నెలవారీ నివేదిక' : 'Monthly Report';
    if (period === 'yearly') return lang === 'telugu' ? 'వార్షిక నివేదిక' : 'Yearly Report';
    return lang === 'telugu' ? 'ఈరోజు నివేదిక' : 'Daily Report';
}

function getPeriodRange(period) {
    const now = new Date();
    if (period === 'weekly') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 7);
        return { start, end: now };
    }
    if (period === 'daily') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }
    if (period === 'monthly') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    if (period === 'yearly') {
        return { start: new Date(now.getFullYear(), 0, 1), end: now };
    }
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
}

function computeStatusMessage(totalIncome, totalExpense, lang) {
    if (totalExpense === 0) return personalText(lang, 'status_no_expenses');
    if (totalIncome <= 0) return personalText(lang, 'status_spending_lot');
    if (totalExpense < (totalIncome * 0.5)) return personalText(lang, 'status_good_savings');
    if (totalExpense < (totalIncome * 0.8)) return personalText(lang, 'status_control');
    return personalText(lang, 'status_spending_lot');
}

async function handlePersonalPdfReport({ phoneNumber, personalUserId, lang, period }) {
    try {
        const anyRes = await db.query(
            'SELECT COUNT(1) as c FROM personaliq_transactions WHERE personaliq_user_id = $1',
            [personalUserId]
        );
        if (parseInt(anyRes.rows[0].c, 10) === 0) {
            await sendWhatsAppMessage(phoneNumber, personalText(lang, 'no_data'));
            return;
        }

        const allIncomeRes = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM personaliq_transactions WHERE personaliq_user_id = $1 AND type = 'income'",
            [personalUserId]
        );
        const allExpenseRes = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM personaliq_transactions WHERE personaliq_user_id = $1 AND type = 'expense'",
            [personalUserId]
        );
        const totalIncome = parseFloat(allIncomeRes.rows[0].total);
        const totalExpenseAll = parseFloat(allExpenseRes.rows[0].total);
        const balanceAll = totalIncome - totalExpenseAll;

        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const todayExpenseRes = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM personaliq_transactions WHERE personaliq_user_id = $1 AND type = 'expense' AND created_at >= $2",
            [personalUserId, startOfToday]
        );
        const todayExpense = parseFloat(todayExpenseRes.rows[0].total);

        const { start, end } = getPeriodRange(period);

        // PersonalIQ spec for "daily": show today's expense + current month's total expense.
        const expenseRangeForTotal = (() => {
            if (period !== 'daily') return { start, end };
            return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
        })();

        const periodExpenseRes = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM personaliq_transactions WHERE personaliq_user_id = $1 AND type = 'expense' AND created_at >= $2 AND created_at < $3",
            [personalUserId, expenseRangeForTotal.start, expenseRangeForTotal.end]
        );
        const periodExpense = parseFloat(periodExpenseRes.rows[0].total);

        const statusMessage = computeStatusMessage(totalIncome, totalExpenseAll, lang);

        const txRes = await db.query(`
            SELECT created_at, type, amount, category, note
            FROM personaliq_transactions
            WHERE personaliq_user_id = $1 AND created_at >= $2 AND created_at < $3
            ORDER BY created_at DESC
        `, [personalUserId, start, end]);

        const filename = `personaliq_${period}_${Date.now()}.pdf`;
        const pdfPath = await generatePersonalReportPDF({
            lang,
            title: getPeriodTitle(period, lang),
            summary: { balance: balanceAll, todayExpense, totalExpense: periodExpense, statusMessage },
            transactions: txRes.rows,
            filename
        });

        const mediaId = await uploadMedia(pdfPath);
        if (mediaId) {
            await sendWhatsAppDocument(phoneNumber, mediaId, filename);
        } else {
            await sendWhatsAppMessage(
                phoneNumber,
                lang === 'telugu' ? "❌ PDF నివేదిక పంపడం విఫలమైంది." : "❌ Failed to generate or upload PDF report."
            );
        }
    } catch (err) {
        console.error('PersonalIQ PDF error:', err.message);
        await sendWhatsAppMessage(
            phoneNumber,
            lang === 'telugu' ? "❌ PDF తయారుచేయడం విఫలమైంది." : "❌ Failed to generate PDF."
        );
    }
}

async function handlePACTIVATE(adminUserPhone, rawText) {
    const adminPhone = (process.env.ADMIN_PHONE || '').trim();
    if (adminUserPhone !== adminPhone) return personalText('english', 'unauthorized');

    const parsed = parsePersonalMessage(rawText);
    if (!parsed || parsed.command !== 'PACTIVATE') return "❌ Invalid command\n\n👉 Use:\nPACTIVATE <phone_number> <standard|pro>";
    const { targetPhone, planType } = parsed;
    if (planType !== 'pro') return "❌ Invalid plan (use pro)";

    // Infer language from existing VyapaarIQ user if available
    const langRes = await db.query('SELECT language FROM users WHERE phone_number = $1', [targetPhone]);
    const inferredLang = langRes.rows[0]?.language || 'english';

    const personalUser = await ensurePersonalUser(targetPhone, inferredLang);
    const newEndDate = await activateSubscription(personalUser.id, planType);
    const formattedDate = newEndDate.toLocaleDateString('en-GB');

    // Notify target user
    const targetLang = personalUser.language || inferredLang || 'english';
    const userMsg =
        `${personalText(targetLang, 'sub_activated_title')}\n\n` +
        `${personalText(targetLang, 'sub_plan_label')}: *${planType.toUpperCase()}*\n` +
        `${personalText(targetLang, 'sub_valid_till_label')}: *${formattedDate}*\n\n` +
        `${personalText(targetLang, 'sub_thanks')}`;
    await sendWhatsAppMessage(targetPhone, userMsg);

    return personalText('english', 'admin_success', { plan: planType.toUpperCase(), date: formattedDate, phone: targetPhone });
}

async function processPersonalIQMessage({ phoneNumber, language, rawText, fromPhoneNumber }) {
    const parsed = parsePersonalMessage(rawText);

    // Admin activation command (independent of app mode)
    if (parsed && parsed.command === 'PACTIVATE') {
        return await handlePACTIVATE(fromPhoneNumber, rawText);
    }

    const lang = language || 'english';
    const personalUser = await ensurePersonalUser(phoneNumber, lang);
    const sub = await ensureTrialIfMissing(personalUser.id);

    // Multi-command support (only for ADD_TX). Keeps single-command behavior unchanged.
    const commandTexts = splitIntoCommandTexts(rawText);
    if (commandTexts.length > 1) {
        const hasAddTx = commandTexts.some((cmdText) => {
            const p = parsePersonalMessage((cmdText || '').trim());
            return p && p.command === 'ADD_TX';
        });

        if (hasAddTx) {
            if (!sub || sub.status === 'expired') {
                return getPaywallMessage(lang);
            }

            const recorded = [];
            const issues = [];

            for (const rawCmd of commandTexts) {
                const cmdText = (rawCmd || '').trim();
                if (!cmdText) continue;

                const p = parsePersonalMessage(cmdText);
                if (!p || p.command !== 'ADD_TX') {
                    issues.push(`❌ Invalid command: ${cmdText}`);
                    continue;
                }

                // Language enforcement (commands)
                if (lang === 'telugu' && p.sourceLang === 'english') {
                    issues.push(personalText('telugu', 'err_use_telugu_cmds'));
                    continue;
                }
                if (lang === 'english' && p.sourceLang === 'telugu') {
                    issues.push(personalText('english', 'err_use_english_cmds'));
                    continue;
                }

                await addTransaction(personalUser.id, p.type, p.amount, p.category, p.note);

                const amount = formatRupees(p.amount);
                const label = p.type === 'income' ? '💰 Income' : '💸 Expense';
                const note = p.note ? ` (${p.note})` : '';
                recorded.push(`${label}: ₹${amount}${note}`);
            }

            if (recorded.length === 0) {
                return issues.length ? `❌ No entries recorded.\n\n${issues.join('\n\n')}` : '❌ No entries recorded.';
            }

            let message = `✅ Entries recorded:\n\n${recorded.join('\n')}`;
            if (issues.length) message += `\n\n❌ Issues:\n\n${issues.join('\n\n')}`;
            return await appendPersonalNetMetrics(personalUser.id, message, lang);
        }
    }

    if (!parsed) {
        return personalText(lang, 'welcome');
    }

    // Language enforcement (commands)
    if (!['PAID', 'PACTIVATE'].includes(parsed.command)) {
        if (lang === 'telugu' && parsed.sourceLang === 'english') {
            return personalText('telugu', 'err_use_telugu_cmds');
        }
        if (lang === 'english' && parsed.sourceLang === 'telugu') {
            return personalText('english', 'err_use_english_cmds');
        }
    }

    if (parsed.command === 'PAID') {
        return await handlePaid({ lang, fromPhoneNumber: phoneNumber, planType: parsed.planType });
    }

    if (parsed.command === 'UNDO') {
        const last = await getLastTransaction(personalUser.id);
        if (!last) return personalText(lang, 'undo_none');
        await deleteTransaction(last.id);
        const undoMsg = personalText(lang, 'undo_success');
        return await appendPersonalNetMetrics(personalUser.id, undoMsg, lang);
    }

    if (!sub || sub.status === 'expired') {
        return getPaywallMessage(lang);
    }

    // Plan gating
    if (sub.plan_type === 'standard' && parsed.command === 'REPORT' && isProAllowed(parsed.period)) {
        return `${personalText(lang, 'upgrade_required')}\n${personalText(lang, 'pay_pro')}`;
    }

    if (parsed.command === 'ADD_TX') {
        await addTransaction(personalUser.id, parsed.type, parsed.amount, parsed.category, parsed.note);
        const addMsg = parsed.type === 'income'
            ? personalText(lang, 'income_added', { amount: parsed.amount })
            : personalText(lang, 'expense_added', { amount: parsed.amount });
        return await appendPersonalNetMetrics(personalUser.id, addMsg, lang);
    }

    if (parsed.command === 'REPORT') {
        if (parsed.isPdf) {
            handlePersonalPdfReport({ phoneNumber, personalUserId: personalUser.id, lang, period: parsed.period });
            return lang === 'telugu' ? '⏳ PDF నివేదిక తయారవుతోంది...' : '⏳ Generating PDF report...';
        }
        return await getPersonalSummary(personalUser.id, lang, parsed.period);
    }

    return personalText(lang, 'welcome');
}

module.exports = { processPersonalIQMessage };
