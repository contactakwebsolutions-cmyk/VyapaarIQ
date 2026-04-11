const { toTelugu, hasTelugu } = require('../src/services/transliterationService');

describe('Transliteration Service (Latin -> Telugu)', () => {
    test('Should transliterate simple names', () => {
        expect(toTelugu('Sai')).toBe('సై');
        expect(hasTelugu(toTelugu('Kishore'))).toBe(true);
    });

    test('Should not change Telugu input', () => {
        expect(toTelugu('కిషోర్')).toBe('కిషోర్');
        expect(hasTelugu(toTelugu('కిషోర్'))).toBe(true);
    });

    test('Should keep non-name strings unchanged', () => {
        expect(toTelugu('S 2000 saree')).toBe('S 2000 saree');
    });
});
