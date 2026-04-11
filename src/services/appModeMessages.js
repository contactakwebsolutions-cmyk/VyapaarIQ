function modePrompt(lang) {
    if (lang === 'telugu') {
        return (
            "*మీరు ఏది ఉపయోగించాలి? (1 లేదా 2):*\n" +
            "1) Business (VyapaarIQ)\n" +
            "2) Personal (PersonalIQ)\n\n" +
            "(*ఒక్కసారి సెట్ చేసిన తర్వాత మార్చలేరు*)"
        );
    }

    return (
        "*Choose your mode (Reply 1 or 2):*\n" +
        "1) Business (VyapaarIQ)\n" +
        "2) Personal (PersonalIQ)\n\n" +
        "(*Once set, cannot be changed*)"
    );
}

function modeConfirmPrompt(lang, pendingMode) {
    const label = pendingMode === 'personal' ? 'Personal (PersonalIQ)' : 'Business (VyapaarIQ)';
    if (lang === 'telugu') {
        return `మీరు *${label}* ఎంచుకున్నారు.\nConfirm? *YES* / *NO*\n\nగమనిక: ఒకసారి సెట్ చేసిన తర్వాత మార్చలేరు.`;
    }
    return `You selected *${label}*.\nConfirm? Reply *YES* / *NO*\n\nNote: Once set, cannot be changed.`;
}

module.exports = { modePrompt, modeConfirmPrompt };

