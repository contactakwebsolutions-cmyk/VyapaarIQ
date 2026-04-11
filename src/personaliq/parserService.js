function isStrictNumeric(str) {
    return /^\d+(\.\d+)?$/.test(str);
}

function hasTelugu(text) {
    return /[\u0C00-\u0C7F]/.test(text || '');
}

function parsePersonalMessage(text) {
    if (!text) return null;
    const cleanText = text.replace(/[*_~`]/g, '').trim();
    if (!cleanText) return null;

    const isPdfRequested = text.toLowerCase().includes('pdf') || text.includes('పిడిఎఫ్');
    const parts = cleanText
        .split(/\s+/)
        .filter(p => p.toLowerCase() !== 'pdf' && p !== 'పిడిఎఫ్');
    if (parts.length === 0) return null;
    const cmdRaw = parts[0];
    const cmd = cmdRaw.toUpperCase();
    const cmdLower = cmdRaw.toLowerCase();
    const sourceLang = hasTelugu(cmdRaw) ? 'telugu' : 'english';

    if (cmd === 'I' || cmd === 'E' || cmdRaw === 'ఆ' || cmdRaw === 'ఖ' || cmdRaw === 'ఆదాయం' || cmdRaw === 'ఖర్చు') {
        if (parts.length < 2) return null;
        if (!isStrictNumeric(parts[1])) return null;
        const amount = parseFloat(parts[1]);
        const noteParts = parts.slice(2);
        const note = noteParts.join(' ') || null;
        const category = noteParts.length > 0 ? noteParts[0].toLowerCase() : null;

        return {
            command: 'ADD_TX',
            type: (cmd === 'I' || cmdRaw === 'ఆ' || cmdRaw === 'ఆదాయం') ? 'income' : 'expense',
            amount,
            category,
            note,
            sourceLang
        };
    }

    if (['daily', 'weekly', 'monthly', 'yearly', 'ఈరోజు', 'రోజూ', 'డైలీ', 'వారం', 'నెల', 'ఏడాది', 'సంవత్సరం'].includes(cmdLower) || ['ఈరోజు', 'రోజూ', 'డైలీ', 'వారం', 'నెల', 'ఏడాది', 'సంవత్సరం'].includes(cmdRaw)) {
        const period = (() => {
            if (cmdLower === 'weekly' || cmdRaw === 'వారం') return 'weekly';
            if (cmdLower === 'monthly' || cmdRaw === 'నెల') return 'monthly';
            if (cmdLower === 'yearly' || cmdRaw === 'ఏడాది' || cmdRaw === 'సంవత్సరం') return 'yearly';
            return 'daily';
        })();
        return { command: 'REPORT', period, isPdf: isPdfRequested, sourceLang };
    }

    if (cmdLower === 'undo' || cmdRaw === 'వెనక్కి') {
        return { command: 'UNDO', sourceLang };
    }

    if (cmd === 'PAID') {
        const planType = parts[1] ? parts[1].toLowerCase() : null;
        return { command: 'PAID', planType, sourceLang };
    }

    if (cmdRaw === 'చెల్లించాను' || cmdRaw === 'చెల్లించా') {
        let planType = parts[1] ? parts[1].toLowerCase() : null;
        if (planType === 'స్టాండర్డ్' || planType === 'స్టాండర్డ్‌') planType = 'standard';
        if (planType === 'ప్రో' || planType === 'ప్రో‌') planType = 'pro';
        return { command: 'PAID', planType, sourceLang };
    }

    if (cmd === 'PACTIVATE') {
        if (parts.length < 3) return null;
        return {
            command: 'PACTIVATE',
            targetPhone: parts[1],
            planType: parts[2].toLowerCase(),
            sourceLang
        };
    }

    return null;
}

module.exports = { parsePersonalMessage };
