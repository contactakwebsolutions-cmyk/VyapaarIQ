/**
 * A basic phonetic transliterator for Telugu names to English/Latin script.
 */

const teluguToLatinMap = {
    // Vowels
    'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo',
    'ఋ': 'ru', 'ౠ': 'ruu', 'ఎ': 'e', 'ఏ': 'ae', 'ఐ': 'ai',
    'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au', 'అం': 'am', 'అః': 'ah',

    // Consonants
    'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ng',
    'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny',
    'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
    'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
    'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm',
    'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v', 'శ': 'sh', 
    'ష': 'sh', 'స': 's', 'హ': 'h', 'ళ': 'l', 'క్ష': 'ksh', 'ఱ': 'r',

    // Guninthalu (Matras)
    'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo',
    'ృ': 'ru', 'ె': 'e', 'ే': 'ae', 'ై': 'ai', 'ొ': 'o',
    'ో': 'o', 'ౌ': 'au', '్': '', 'ౄ': 'ruu', 'ం': 'm', 'ః': 'h'
};

// Simple Reverse Map (English to Telugu) is much harder because of ambiguity.
// For now we primarily focus on Telugu -> English for matching and display.

/**
 * Transliterates a Telugu script name to a Latin (English) script.
 * @param {string} text 
 * @returns {string}
 */
function toEnglish(text) {
    if (!text) return '';
    let result = '';
    
    // Check if text is actually Telugu
    const isTelugu = /[\u0C00-\u0C7F]/.test(text);
    if (!isTelugu) return text;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        // If it's a vowel mark (gunintham), we might want to override a previous vowel?
        // But for names, simple replacement is usually enough.
        result += teluguToLatinMap[char] !== undefined ? teluguToLatinMap[char] : char;
    }
    
    // Basic cleanup: remove any residual Telugu characters and capitalize
    const cleaned = result.replace(/[\u0C00-\u0C7F]/g, '');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function looksLikeLatinName(text) {
    if (!text) return false;
    return /^[a-zA-Z][a-zA-Z .'-]*$/.test(text.trim());
}

// Practical (approximate) English/Latin -> Telugu transliteration for common names.
// Ambiguity is expected; users can override by entering Telugu name directly later.
function toTelugu(text) {
    if (!text) return '';
    if (hasTelugu(text)) return text;
    if (!looksLikeLatinName(text)) return text;

    const input = text.trim().toLowerCase();
    let i = 0;
    let out = '';

    const independentVowels = {
        a: '\u0C05',
        aa: '\u0C06',
        i: '\u0C07',
        ee: '\u0C08',
        e: '\u0C0E',
        ai: '\u0C10',
        u: '\u0C09',
        oo: '\u0C0A',
        o: '\u0C12',
        au: '\u0C14'
    };

    const vowelSigns = {
        a: '',
        aa: '\u0C3E',
        i: '\u0C3F',
        ee: '\u0C40',
        e: '\u0C46',
        ai: '\u0C48',
        u: '\u0C41',
        oo: '\u0C42',
        o: '\u0C4A',
        au: '\u0C4C'
    };

    const consonants = [
        ['ksh', '\u0C15\u0C4D\u0C37'],
        ['ng', '\u0C19'],
        ['ny', '\u0C1E'],
        ['kh', '\u0C16'],
        ['gh', '\u0C18'],
        ['chh', '\u0C1B'],
        ['ch', '\u0C1A'],
        ['jh', '\u0C1D'],
        ['th', '\u0C24'],
        ['dh', '\u0C27'],
        ['ph', '\u0C2B'],
        ['bh', '\u0C2D'],
        ['sh', '\u0C36'],
        ['k', '\u0C15'],
        ['g', '\u0C17'],
        ['c', '\u0C15'],
        ['j', '\u0C1C'],
        ['t', '\u0C24'],
        ['d', '\u0C26'],
        ['n', '\u0C28'],
        ['p', '\u0C2A'],
        ['b', '\u0C2C'],
        ['m', '\u0C2E'],
        ['y', '\u0C2F'],
        ['r', '\u0C30'],
        ['l', '\u0C32'],
        ['v', '\u0C35'],
        ['w', '\u0C35'],
        ['s', '\u0C38'],
        ['h', '\u0C39']
    ];

    const readVowel = (pos) => {
        const chunk2 = input.slice(pos, pos + 2);
        if (vowelSigns[chunk2] !== undefined) return chunk2;
        const chunk1 = input.slice(pos, pos + 1);
        if (vowelSigns[chunk1] !== undefined) return chunk1;
        return null;
    };

    const readConsonant = (pos) => {
        for (const [pat, tel] of consonants) {
            if (input.startsWith(pat, pos)) return { pat, tel };
        }
        return null;
    };

    while (i < input.length) {
        const ch = input[i];
        if (ch === ' ' || ch === '.' || ch === '-' || ch === '\'') {
            out += ch;
            i += 1;
            continue;
        }

        const startVowel = readVowel(i);
        if (startVowel) {
            out += independentVowels[startVowel] || independentVowels[startVowel[0]];
            i += startVowel.length;
            continue;
        }

        const cons = readConsonant(i);
        if (!cons) {
            out += input[i];
            i += 1;
            continue;
        }

        i += cons.pat.length;
        const vowel = readVowel(i) || 'a';
        if (vowel !== 'a') i += vowel.length;
        out += cons.tel + (vowelSigns[vowel] ?? '');
    }

    return out;
}

/**
 * Normalizes a name for comparison across languages.
 * Strips special chars and converts to lower case.
 */
function normalize(name) {
    if (!name) return '';
    // If it's Telugu, convert to English for a common comparison key
    const eng = toEnglish(name);
    return eng.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Checks if a string contains Telugu characters
 */
function hasTelugu(text) {
    return /[\u0C00-\u0C7F]/.test(text);
}

module.exports = {
    toEnglish,
    toTelugu,
    normalize,
    hasTelugu
};
