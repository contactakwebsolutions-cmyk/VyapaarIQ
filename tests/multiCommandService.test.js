const { splitIntoCommandTexts } = require('../src/services/multiCommandService');

describe('Multi-command splitting', () => {
    test('Splits by newline', () => {
        const input = 'S 250 Saree\nS 300\nE 400\nP Kishore 300';
        expect(splitIntoCommandTexts(input)).toEqual(['S 250 Saree', 'S 300', 'E 400', 'P Kishore 300']);
    });

    test('Splits by comma when next token looks like a command', () => {
        const input = 'S 100, E 50, P Kishore 20';
        expect(splitIntoCommandTexts(input)).toEqual(['S 100', 'E 50', 'P Kishore 20']);
    });

    test('Does not split comma inside descriptions', () => {
        const input = 'S 100 milk, bread';
        expect(splitIntoCommandTexts(input)).toEqual(['S 100 milk, bread']);
    });

    test('Trims and ignores empty parts', () => {
        const input = '\n  S 100  \n\n, E 20   \n';
        expect(splitIntoCommandTexts(input)).toEqual(['S 100', 'E 20']);
    });
});

