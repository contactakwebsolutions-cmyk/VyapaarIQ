/**
 * Parses user input commands from WhatsApp
 * @param {string} text 
 * @returns {Object|null} Parsed command object or null if invalid
 */
function parseMessage(text) {
    if (!text) return null;
    
    // Clean WhatsApp formatting characters (*bold*, _italic_, ~strike~, `code`)
    const cleanText = text.replace(/[*_~`]/g, '').trim();
    const parts = cleanText.split(/\s+/);
    if (parts.length === 0 || parts[0] === '') return null;
    
    const command = parts[0].toUpperCase();
    const isPdfRequested = text.toLowerCase().includes('pdf');
    
    // Helper to check if a command is Telugu script
    const isTelugu = (cmd) => /[\u0C00-\u0C7F]/.test(cmd);
    const sourceLang = isTelugu(command) ? 'telugu' : 'english';

    // Command: START (onboarding)
    if (command === 'START') {
        return { command: 'START', sourceLang };
    }

    // Command: DAILY [YYYY-MM-DD]
    if (command === 'REPORT' || command === 'DAILY' || command === 'ఈరోజు' || command === 'రోజూ' || command === 'డైలీ') {
        const dateStr = parts[1];
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        let result = { command: 'DAILY', sourceLang };
        if (dateStr && dateRegex.test(dateStr)) {
            result.date = dateStr;
        }
        if (isPdfRequested) result.isPdf = true;
        return result;
    }

    // Command: WEEKLY
    if (command === 'WEEKLY' || command === 'వారం') {
        return { command: 'WEEKLY', isPdf: isPdfRequested, sourceLang };
    }

    // Command: MONTHLY
    if (command === 'MONTHLY' || command === 'నెల') {
        return { command: 'MONTHLY', isPdf: isPdfRequested, sourceLang };
    }

    // Command: YEARLY
    if (command === 'YEARLY' || command === 'ఏడాది') {
        return { command: 'YEARLY', isPdf: isPdfRequested, sourceLang };
    }

    // Command: UNDO
    if (command === 'UNDO' || command === 'వెనక్కి') {
        return { command: 'UNDO', sourceLang };
    }

    // Command: SYNC
    if (command === 'SYNC' || command === 'సింక్') {
        return { command: 'SYNC', sourceLang };
    }

    // Command: LANGUAGE
    if (command === 'TELUGU' || command === 'ENGLISH' || command === 'తెలుగు' || command === 'ఇంగ్లీష్') {
        let lang = 'english';
        if (command === 'TELUGU' || command === 'తెలుగు') lang = 'telugu';
        return { command: 'SET_LANG', lang: lang, sourceLang };
    }
    
    // Command: SALE
    if (command === 'S' || command === 'అ') {
        if (parts.length < 2) return null;
        
        if (isStrictNumeric(parts[1])) {
            // Cash Sale: S amount category
            return {
                command: 'SALE',
                type: 'cash',
                amount: parseFloat(parts[1]),
                category: parts.slice(2).join(' ') || null,
                sourceLang
            };
        } else {
            // Credit Sale: S name amount category
            if (parts.length < 3) return null;
            if (!isStrictNumeric(parts[2])) return null;
            const amount = parseFloat(parts[2]);
            
            return {
                command: 'SALE',
                type: 'credit',
                customerName: parts[1],
                amount: amount,
                category: parts.slice(3).join(' ') || null,
                sourceLang
            };
        }
    }
    
    // Command: EXPENSE
    if (command === 'E' || command === 'ఖ') {
        // Expense: E amount category
        if (parts.length < 2) return null;
        if (!isStrictNumeric(parts[1])) return null;
        const amount = parseFloat(parts[1]);
        
        return {
            command: 'EXPENSE',
            amount: amount,
            category: parts.slice(2).join(' ') || null,
            sourceLang
        };
    }
    
    // Command: PAYMENT
    if (command === 'P' || command === 'వ') {
        // Payment: P name amount
        if (parts.length < 3) return null;
        if (!isStrictNumeric(parts[2])) return null;
        const amount = parseFloat(parts[2]);
        
        return {
            command: 'PAYMENT',
            customerName: parts[1],
            amount: amount,
            sourceLang
        };
    }
    
    // Command: PAID <plan> (allow Telugu alias too)
    if (command === 'PAID' || command === 'చెల్లించాను' || command === 'చెల్లించా') {
        let planType = parts[1] ? parts[1].toLowerCase() : null;
        if (planType === 'స్టాండర్డ్' || planType === 'స్టాండర్డ్‌') planType = 'standard';
        if (planType === 'ప్రో' || planType === 'ప్రో‌') planType = 'pro';
        return {
            command: 'PAID',
            planType,
            sourceLang
        };
    }

    // Command: ACTIVATE <phone> <plan>
    if (command === 'ACTIVATE') {
        if (parts.length < 3) return null;
        return {
            command: 'ACTIVATE',
            targetPhone: parts[1],
            planType: parts[2].toLowerCase(),
            sourceLang
        };
    }

    // Command: WELCOME / HELP
    if (['HI', 'HELLO', 'HELP', 'నమస్కారం', 'హలో', 'నమస్తే'].includes(command)) {
        return { command: 'WELCOME', sourceLang };
    }
    
    return null;
}

/**
 * Validates if a string is a strict positive number (integer or decimal)
 * @param {string} str 
 * @returns {boolean}
 */
function isStrictNumeric(str) {
    return /^\d+(\.\d+)?$/.test(str);
}

module.exports = {
    parseMessage
};
