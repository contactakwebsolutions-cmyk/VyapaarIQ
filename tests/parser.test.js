const { parseMessage } = require('../src/services/parserService');

describe('Parser Service Tests', () => {
    test('Should parse CASH SALE "S 2000 saree" correctly', () => {
        const result = parseMessage('S 2000 saree');
        expect(result).toEqual({
            command: 'SALE',
            type: 'cash',
            amount: 2000,
            category: 'saree',
            sourceLang: 'english'
        });
    });

    test('Should parse CASH SALE "S 2000" correctly (without category)', () => {
        const result = parseMessage('S 2000');
        expect(result).toEqual({
            command: 'SALE',
            type: 'cash',
            amount: 2000,
            category: null,
            sourceLang: 'english'
        });
    });

    test('Should parse CREDIT SALE "S Kishore 2000 saree" correctly', () => {
        const result = parseMessage('S Kishore 2000 saree');
        expect(result).toEqual({
            command: 'SALE',
            type: 'credit',
            customerName: 'Kishore',
            amount: 2000,
            category: 'saree',
            sourceLang: 'english'
        });
    });
    
    test('Should parse CREDIT SALE "S Kishore 2000" correctly (without category)', () => {
        const result = parseMessage('S Kishore 2000');
        expect(result).toEqual({
            command: 'SALE',
            type: 'credit',
            customerName: 'Kishore',
            amount: 2000,
            category: null,
            sourceLang: 'english'
        });
    });

    test('Should parse EXPENSE "E 500 petrol" correctly', () => {
        const result = parseMessage('E 500 petrol');
        expect(result).toEqual({
            command: 'EXPENSE',
            amount: 500,
            category: 'petrol',
            sourceLang: 'english'
        });
    });
    
    test('Should parse EXPENSE "E 500" correctly (without category)', () => {
        const result = parseMessage('E 500');
        expect(result).toEqual({
            command: 'EXPENSE',
            amount: 500,
            category: null,
            sourceLang: 'english'
        });
    });

    test('Should parse PAYMENT "P Kishore 1000" correctly', () => {
        const result = parseMessage('P Kishore 1000');
        expect(result).toEqual({
            command: 'PAYMENT',
            customerName: 'Kishore',
            amount: 1000,
            sourceLang: 'english'
        });
    });

    test('Should parse REPORT "report" correctly (case insensitive)', () => {
        const result1 = parseMessage('report');
        const result2 = parseMessage('REPORT');
        const result3 = parseMessage('Report');
        
        expect(result1).toEqual({ command: 'DAILY', sourceLang: 'english' });
        expect(result2).toEqual({ command: 'DAILY', sourceLang: 'english' });
        expect(result3).toEqual({ command: 'DAILY', sourceLang: 'english' });
    });

    test('Should return null for invalid commands', () => {
        expect(parseMessage('')).toBeNull();
        expect(parseMessage('UNKNOWN 1000')).toBeNull();
        expect(parseMessage('S')).toBeNull();
        expect(parseMessage('E')).toBeNull();
        expect(parseMessage('P Kishore')).toBeNull(); // Missing amount
    });
});
