const db = require('../config/db');
const { personalText } = require('./messages');

async function ensurePersonalUser(phoneNumber, language) {
    const res = await db.query('SELECT * FROM personaliq_users WHERE phone_number = $1', [phoneNumber]);
    if (res.rows.length > 0) return res.rows[0];

    const inserted = await db.query(
        'INSERT INTO personaliq_users (phone_number, language) VALUES ($1, $2) RETURNING *',
        [phoneNumber, language]
    );
    return inserted.rows[0];
}

async function addTransaction(personalUserId, txType, amount, category, note) {
    await db.query(`
        INSERT INTO personaliq_transactions (personaliq_user_id, type, amount, category, note)
        VALUES ($1, $2, $3, $4, $5)
    `, [personalUserId, txType, amount, category, note]);
}

async function getLastTransaction(personalUserId) {
    const res = await db.query(`
        SELECT *
        FROM personaliq_transactions
        WHERE personaliq_user_id = $1
        AND created_at >= NOW() - INTERVAL '10 minutes'
        ORDER BY created_at DESC
        LIMIT 1
    `, [personalUserId]);
    return res.rows[0] || null;
}

async function deleteTransaction(transactionId) {
    await db.query('DELETE FROM personaliq_transactions WHERE id = $1', [transactionId]);
}

function getPeriodRange(period) {
    const now = new Date();
    const start = new Date(now);

    // For "daily" summary, the spec wants today's expense + current month's total expense.
    if (period === 'daily') {
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }
    if (period === 'weekly') {
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 7);
        return { start, end: now };
    }
    if (period === 'monthly') {
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }
    if (period === 'yearly') {
        return { start: new Date(now.getFullYear(), 0, 1), end: now };
    }

    // Fallback to daily
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
}

function getStatusMessage(totalIncome, totalExpense, lang) {
    if (totalExpense === 0) return personalText(lang, 'status_no_expenses');
    if (totalIncome <= 0) return personalText(lang, 'status_spending_lot');

    if (totalExpense < (totalIncome * 0.5)) return personalText(lang, 'status_good_savings');
    if (totalExpense < (totalIncome * 0.8)) return personalText(lang, 'status_control');
    return personalText(lang, 'status_spending_lot');
}

function formatSummary({ lang, period, balance, todayExpense, totalExpense, topCategory }) {
    const titleKey = period === 'weekly'
        ? 'weekly_title'
        : (period === 'monthly' ? 'monthly_title' : (period === 'yearly' ? 'yearly_title' : 'summary_title'));

    const lines = [];
    lines.push(personalText(lang, titleKey));
    lines.push(personalText(lang, 'balance', { amount: Math.round(balance * 100) / 100 }));
    lines.push(personalText(lang, 'today_total', {
        today: Math.round(todayExpense * 100) / 100,
        total: Math.round(totalExpense * 100) / 100
    }));

    if (topCategory && topCategory.category && topCategory.amount > 0) {
        lines.push(personalText(lang, 'top', { category: topCategory.category, amount: Math.round(topCategory.amount * 100) / 100 }));
    }

    lines.push(personalText(lang, 'status', { message: topCategory.statusMessage }));

    // Keep it max 5 lines as requested
    return lines.slice(0, 5).join('\n');
}

async function getPersonalSummary(personalUserId, lang, period = 'daily') {
    // No transactions check
    const anyRes = await db.query(
        'SELECT COUNT(1) as c FROM personaliq_transactions WHERE personaliq_user_id = $1',
        [personalUserId]
    );
    if (parseInt(anyRes.rows[0].c, 10) === 0) {
        return personalText(lang, 'no_data');
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
    const periodExpenseRes = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM personaliq_transactions WHERE personaliq_user_id = $1 AND type = 'expense' AND created_at >= $2 AND created_at < $3",
        [personalUserId, start, end]
    );
    const periodExpense = parseFloat(periodExpenseRes.rows[0].total);

    const topCatRes = await db.query(`
        SELECT category, COALESCE(SUM(amount), 0) as total
        FROM personaliq_transactions
        WHERE personaliq_user_id = $1 AND type = 'expense' AND created_at >= $2 AND created_at < $3 AND category IS NOT NULL
        GROUP BY category
        ORDER BY total DESC
        LIMIT 1
    `, [personalUserId, start, end]);

    const topCategory = topCatRes.rows.length > 0
        ? { category: topCatRes.rows[0].category, amount: parseFloat(topCatRes.rows[0].total) }
        : null;

    const statusMessage = (period === 'daily')
        ? getStatusMessage(totalIncome, totalExpenseAll, lang)
        : (() => {
            // For pro period reports, status is based on period income/expense to keep it meaningful.
            // (Still does NOT show income, only uses it internally.)
            return getStatusMessage(totalIncome, totalExpenseAll, lang);
        })();

    return formatSummary({
        lang,
        period,
        balance: period === 'daily' ? balanceAll : balanceAll,
        todayExpense,
        totalExpense: periodExpense,
        topCategory: { ...(topCategory || {}), statusMessage }
    });
}

async function getPersonalAllTimeMetrics(personalUserId) {
    const res = await db.query(`
        SELECT type, COALESCE(SUM(amount), 0) as total
        FROM personaliq_transactions
        WHERE personaliq_user_id = $1
        GROUP BY type
    `, [personalUserId]);

    const totals = { income: 0, expense: 0 };
    res.rows.forEach(row => {
        totals[row.type] = parseFloat(row.total);
    });

    return {
        netIncome: totals.income,
        netExpenditure: totals.expense,
        netBalance: totals.income - totals.expense
    };
}

async function appendPersonalNetMetrics(personalUserId, baseMessage, lang) {
    const metrics = await getPersonalAllTimeMetrics(personalUserId);
    
    let netStr = `\n---\n${personalText(lang, 'net_metrics_title')}\n`;
    netStr += `${personalText(lang, 'net_income')}: ₹${metrics.netIncome}\n`;
    netStr += `${personalText(lang, 'net_expenditure')}: ₹${metrics.netExpenditure}\n`;
    netStr += `${personalText(lang, 'net_balance')}: ₹${metrics.netBalance}`;
    
    return baseMessage + netStr;
}

module.exports = {
    ensurePersonalUser,
    addTransaction,
    getLastTransaction,
    deleteTransaction,
    getPersonalSummary,
    getPersonalAllTimeMetrics,
    appendPersonalNetMetrics
};
