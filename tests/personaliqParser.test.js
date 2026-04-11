const { parsePersonalMessage } = require('../src/personaliq/parserService');

describe('PersonalIQ Parser', () => {
    test('Parses income', () => {
        expect(parsePersonalMessage('I 30000 salary')).toEqual({
            command: 'ADD_TX',
            type: 'income',
            amount: 30000,
            category: 'salary',
            note: 'salary',
            sourceLang: 'english'
        });
    });

    test('Parses expense', () => {
        expect(parsePersonalMessage('E 200 food')).toEqual({
            command: 'ADD_TX',
            type: 'expense',
            amount: 200,
            category: 'food',
            note: 'food',
            sourceLang: 'english'
        });
    });

    test('Parses Telugu income/expense commands', () => {
        expect(parsePersonalMessage('ఆ 30000 జీతం')).toEqual({
            command: 'ADD_TX',
            type: 'income',
            amount: 30000,
            category: 'జీతం',
            note: 'జీతం',
            sourceLang: 'telugu'
        });

        expect(parsePersonalMessage('ఖ 200 ఫుడ్')).toEqual({
            command: 'ADD_TX',
            type: 'expense',
            amount: 200,
            category: 'ఫుడ్',
            note: 'ఫుడ్',
            sourceLang: 'telugu'
        });
    });

    test('Parses reports', () => {
        expect(parsePersonalMessage('daily')).toEqual({ command: 'REPORT', period: 'daily', isPdf: false, sourceLang: 'english' });
        expect(parsePersonalMessage('Weekly')).toEqual({ command: 'REPORT', period: 'weekly', isPdf: false, sourceLang: 'english' });
        expect(parsePersonalMessage('MONTHLY')).toEqual({ command: 'REPORT', period: 'monthly', isPdf: false, sourceLang: 'english' });
        expect(parsePersonalMessage('yearly')).toEqual({ command: 'REPORT', period: 'yearly', isPdf: false, sourceLang: 'english' });
    });

    test('Parses paid', () => {
        expect(parsePersonalMessage('PAID standard')).toEqual({ command: 'PAID', planType: 'standard', sourceLang: 'english' });
    });

    test('Parses PACTIVATE', () => {
        expect(parsePersonalMessage('PACTIVATE 919000861903 pro')).toEqual({
            command: 'PACTIVATE',
            targetPhone: '919000861903',
            planType: 'pro',
            sourceLang: 'english'
        });
    });

    test('Parses undo', () => {
        expect(parsePersonalMessage('undo')).toEqual({ command: 'UNDO', sourceLang: 'english' });
        expect(parsePersonalMessage('వెనక్కి')).toEqual({ command: 'UNDO', sourceLang: 'telugu' });
    });

    test('Parses pdf reports', () => {
        expect(parsePersonalMessage('daily pdf')).toEqual({ command: 'REPORT', period: 'daily', isPdf: true, sourceLang: 'english' });
        expect(parsePersonalMessage('pdf weekly')).toEqual({ command: 'REPORT', period: 'weekly', isPdf: true, sourceLang: 'english' });
        expect(parsePersonalMessage('ఈరోజు pdf')).toEqual({ command: 'REPORT', period: 'daily', isPdf: true, sourceLang: 'telugu' });
    });

    test('Pdf alone falls back to welcome', () => {
        expect(parsePersonalMessage('pdf')).toBeNull();
    });
});
