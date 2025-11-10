/**
 * Unit tests for Display Name formatting according to Opuzen naming convention
 */

const ProductModel = require('../models/ProductModel');

describe('Display Name Formatting', () => {
    let productModel;
    
    beforeAll(() => {
        productModel = new ProductModel();
    });
    
    // Test cases based on the approved naming convention
    const testCases = [
        {
            description: 'Single color',
            productName: 'Fox & Hound',
            colors: 'Yuma',
            expected: 'Fox and Hound: Yuma'
        },
        {
            description: 'Two colors with &',
            productName: 'French Knots',
            colors: 'Cookies & Cream',
            expected: 'French Knots: Cookies and Cream'
        },
        {
            description: 'Multiple colors with /',
            productName: 'Amsterdam Net',
            colors: 'Green/Blue/Multi',
            expected: 'Amsterdam Net: Green, Blue, Multi'
        },
        {
            description: 'Product name with special chars',
            productName: 'Crest 2 SUN',
            colors: 'Silver/Warm Grey/Black',
            expected: 'Crest 2 SUN: Silver, Warm Grey, Black'
        },
        {
            description: 'Colors as array',
            productName: 'Test Pattern',
            colors: ['Red', 'Blue', 'Green', 'Yellow'],
            expected: 'Test Pattern: Red, Blue, Green, Yellow'
        },
        {
            description: 'Two colors as array',
            productName: 'Simple & Clean',
            colors: ['White', 'Black'],
            expected: 'Simple and Clean: White and Black'
        },
        {
            description: 'No colors',
            productName: 'Solo Product',
            colors: '',
            expected: 'Solo Product'
        }
    ];
    
    testCases.forEach((testCase) => {
        test(testCase.description, () => {
            const result = productModel.formatDisplayName(testCase.productName, testCase.colors);
            expect(result).toBe(testCase.expected);
        });
    });
    
    test('handles empty colors gracefully', () => {
        const result = productModel.formatDisplayName('Test Product', '');
        expect(result).toBe('Test Product');
    });
    
    test('handles null colors gracefully', () => {
        const result = productModel.formatDisplayName('Test Product', null);
        expect(result).toBe('Test Product');
    });
    
    test('handles undefined colors gracefully', () => {
        const result = productModel.formatDisplayName('Test Product', undefined);
        expect(result).toBe('Test Product');
    });
});