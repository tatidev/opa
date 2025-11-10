/**
 * Tests for CSV Import Service
 * Tests CSV parsing, validation, and data transformation
 */

const CsvImportService = require('../services/csvImportService');
const fs = require('fs');
const path = require('path');

describe('CsvImportService', () => {
    let csvService;
    let testCsvPath;
    let testCsvBuffer;

    beforeEach(() => {
        csvService = new CsvImportService();
        
        // Create test CSV file
        testCsvPath = path.join(__dirname, 'test-import.csv');
        const testCsvContent = `Item Id (Opuzen Code),Product Name,Color,Width,VR,HR,Vendor,Prop 65 Compliance,AB 2998 Compliance,Repeat (No-Repeat)
1354-6543,Tranquil,Ash,54.00,12.5,8.25,Vendor A,Y,Y,Repeat
2001-5678K,Berba,Fiesta,54.00,12.0,8.0,Vendor B,N,N,No-Repeat
9999-0001A,Test Product,Blue,48.00,10.0,6.0,Vendor C,Y,N,Repeat`;
        
        fs.writeFileSync(testCsvPath, testCsvContent);
        testCsvBuffer = Buffer.from(testCsvContent);
    });

    afterEach(() => {
        // Clean up test file
        if (fs.existsSync(testCsvPath)) {
            fs.unlinkSync(testCsvPath);
        }
    });

    describe('Constructor', () => {
        test('should initialize with expected columns', () => {
            expect(csvService.expectedColumns).toHaveLength(25);
            expect(csvService.expectedColumns).toContain('Item Id (Opuzen Code)');
            expect(csvService.expectedColumns).toContain('Product Name');
            expect(csvService.expectedColumns).toContain('Color');
        });

        test('should have required fields defined', () => {
            expect(csvService.requiredFields).toHaveLength(3);
            expect(csvService.requiredFields).toContain('Item Id (Opuzen Code)');
            expect(csvService.requiredFields).toContain('Product Name');
            expect(csvService.requiredFields).toContain('Color');
        });

        test('should have field validators defined', () => {
            expect(csvService.fieldValidators).toHaveProperty('Item Id (Opuzen Code)');
            expect(csvService.fieldValidators).toHaveProperty('Width');
            expect(csvService.fieldValidators).toHaveProperty('Prop 65 Compliance');
        });
    });

    describe('parseCsvFile', () => {
        test('should parse CSV file successfully', async () => {
            const result = await csvService.parseCsvFile(testCsvPath);
            
            expect(result).toHaveLength(3);
            expect(result[0]).toHaveProperty('Item Id (Opuzen Code)', '1354-6543');
            expect(result[0]).toHaveProperty('Product Name', 'Tranquil');
            expect(result[0]).toHaveProperty('Color', 'Ash');
            expect(result[0]).toHaveProperty('Width', '54.00');
        });

        test('should handle empty file', async () => {
            const emptyCsvPath = path.join(__dirname, 'empty.csv');
            fs.writeFileSync(emptyCsvPath, 'Item Id (Opuzen Code),Product Name,Color\n');
            
            try {
                const result = await csvService.parseCsvFile(emptyCsvPath);
                expect(result).toHaveLength(0);
            } finally {
                fs.unlinkSync(emptyCsvPath);
            }
        });

        test.skip('should reject invalid file path', async () => {
            let error;
            try {
                await csvService.parseCsvFile('nonexistent.csv');
            } catch (err) {
                error = err;
            }
            expect(error).toBeDefined();
            expect(error.code).toBe('ENOENT');
        });
    });

    describe('parseCsvBuffer', () => {
        test('should parse CSV buffer successfully', async () => {
            const result = await csvService.parseCsvBuffer(testCsvBuffer);
            
            expect(result).toHaveLength(3);
            expect(result[0]).toHaveProperty('Item Id (Opuzen Code)', '1354-6543');
            expect(result[0]).toHaveProperty('Product Name', 'Tranquil');
        });

        test('should handle empty buffer', async () => {
            const emptyBuffer = Buffer.from('Item Id (Opuzen Code),Product Name,Color\n');
            const result = await csvService.parseCsvBuffer(emptyBuffer);
            expect(result).toHaveLength(0);
        });

        test('should reject buffer with only header', async () => {
            const headerOnlyBuffer = Buffer.from('Item Id (Opuzen Code),Product Name,Color');
            await expect(csvService.parseCsvBuffer(headerOnlyBuffer))
                .rejects.toThrow('CSV must have at least header and one data row');
        });
    });

    describe('parseCsvLine', () => {
        test('should parse simple CSV line', () => {
            const line = '1354-6543,Tranquil,Ash,54.00';
            const result = csvService.parseCsvLine(line);
            
            expect(result).toEqual(['1354-6543', 'Tranquil', 'Ash', '54.00']);
        });

        test('should handle quoted values', () => {
            const line = '1354-6543,"Tranquil Product",Ash,"54.00"';
            const result = csvService.parseCsvLine(line);
            
            expect(result).toEqual(['1354-6543', 'Tranquil Product', 'Ash', '54.00']);
        });

        test('should handle commas within quoted values', () => {
            const line = '1354-6543,"Tranquil, Product",Ash,54.00';
            const result = csvService.parseCsvLine(line);
            
            expect(result).toEqual(['1354-6543', 'Tranquil, Product', 'Ash', '54.00']);
        });

        test('should handle empty values', () => {
            const line = '1354-6543,,Ash,';
            const result = csvService.parseCsvLine(line);
            
            expect(result).toEqual(['1354-6543', '', 'Ash', '']);
        });
    });

    describe('validateCsvData', () => {
        test('should validate valid CSV data', async () => {
            const csvData = await csvService.parseCsvFile(testCsvPath);
            const validation = csvService.validateCsvData(csvData);
            
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            expect(validation.summary.totalRows).toBe(3);
            expect(validation.summary.validRows).toBe(3);
            expect(validation.summary.invalidRows).toBe(0);
        });

        test('should detect missing required fields', async () => {
            const invalidCsvContent = `Item Id (Opuzen Code),Product Name,Color,Width
1354-6543,,Ash,54.00
2001-5678,Berba,,48.00
,Test Product,Blue,54.00`;
            
            const invalidCsvPath = path.join(__dirname, 'invalid.csv');
            fs.writeFileSync(invalidCsvPath, invalidCsvContent);
            
            try {
                const csvData = await csvService.parseCsvFile(invalidCsvPath);
                const validation = csvService.validateCsvData(csvData);
                
                expect(validation.isValid).toBe(false);
                expect(validation.errors.length).toBeGreaterThan(0);
                expect(validation.summary.missingRequiredFields).toBeGreaterThan(0);
            } finally {
                fs.unlinkSync(invalidCsvPath);
            }
        });

        test('should detect duplicate item codes', async () => {
            const duplicateCsvContent = `Item Id (Opuzen Code),Product Name,Color,Width
1354-6543,Tranquil,Ash,54.00
1354-6543,Berba,Blue,48.00
2001-5678,Test Product,Red,54.00`;
            
            const duplicateCsvPath = path.join(__dirname, 'duplicate.csv');
            fs.writeFileSync(duplicateCsvPath, duplicateCsvContent);
            
            try {
                const csvData = await csvService.parseCsvFile(duplicateCsvPath);
                const validation = csvService.validateCsvData(csvData);
                
                expect(validation.isValid).toBe(false);
                expect(validation.errors.some(e => e.includes('Duplicate Item Code'))).toBe(true);
            } finally {
                fs.unlinkSync(duplicateCsvPath);
            }
        });

        test('should detect data type errors', async () => {
            const typeErrorCsvContent = `Item Id (Opuzen Code),Product Name,Color,Width,VR,HR,Prop 65 Compliance
1354-6543,Tranquil,Ash,invalid,12.5,8.25,Maybe
2001-5678,Berba,Blue,54.00,invalid,8.0,Y
9999-0001,Test,Red,48.00,10.0,invalid,N`;
            
            const typeErrorCsvPath = path.join(__dirname, 'type-error.csv');
            fs.writeFileSync(typeErrorCsvPath, typeErrorCsvContent);
            
            try {
                const csvData = await csvService.parseCsvFile(typeErrorCsvPath);
                const validation = csvService.validateCsvData(csvData);
                
                expect(validation.isValid).toBe(false);
                expect(validation.summary.dataTypeErrors).toBeGreaterThan(0);
            } finally {
                fs.unlinkSync(typeErrorCsvPath);
            }
        });

        test('should handle empty CSV data', () => {
            const validation = csvService.validateCsvData([]);
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('CSV file is empty');
        });
    });

    describe('Field Validators', () => {
        describe('validateItemCode', () => {
            test('should validate valid item codes', () => {
                expect(csvService.validateItemCode('1354-6543')).toBe(true);
                expect(csvService.validateItemCode('0000-0001')).toBe(true);
                expect(csvService.validateItemCode('9999-9999')).toBe(true);
                expect(csvService.validateItemCode('7654-8989K')).toBe(true);
                expect(csvService.validateItemCode('2001-5678A')).toBe(true);
                expect(csvService.validateItemCode('1234-5678z')).toBe(true);
            });

            test('should reject invalid item codes', () => {
                expect(csvService.validateItemCode('')).toBe(false);
                expect(csvService.validateItemCode('ABC123')).toBe(false); // Legacy format
                expect(csvService.validateItemCode('123-456')).toBe(false); // Too few digits
                expect(csvService.validateItemCode('12345-6789')).toBe(false); // Too many digits
                expect(csvService.validateItemCode('1234-567AB')).toBe(false); // Multiple letters
            });
        });

        describe('validateDecimal', () => {
            test('should validate valid decimal values', () => {
                expect(csvService.validateDecimal('54.00')).toBe(true);
                expect(csvService.validateDecimal('12.5')).toBe(true);
                expect(csvService.validateDecimal('0')).toBe(true);
                expect(csvService.validateDecimal('')).toBe(true); // Optional field
            });

            test('should reject invalid decimal values', () => {
                expect(csvService.validateDecimal('invalid')).toBe(false);
                expect(csvService.validateDecimal('-5')).toBe(false); // Negative
                expect(csvService.validateDecimal('abc')).toBe(false);
            });
        });

        describe('validateYesNo', () => {
            test('should validate valid Y/N values', () => {
                expect(csvService.validateYesNo('Y')).toBe(true);
                expect(csvService.validateYesNo('N')).toBe(true);
                expect(csvService.validateYesNo('y')).toBe(true);
                expect(csvService.validateYesNo('n')).toBe(true);
                expect(csvService.validateYesNo('')).toBe(true); // Optional field
            });

            test('should reject invalid Y/N values', () => {
                expect(csvService.validateYesNo('Maybe')).toBe(false);
                expect(csvService.validateYesNo('Yes')).toBe(false);
                expect(csvService.validateYesNo('1')).toBe(false);
            });
        });

        describe('validateRepeatField', () => {
            test('should validate valid repeat values', () => {
                expect(csvService.validateRepeatField('Repeat')).toBe(true);
                expect(csvService.validateRepeatField('No-Repeat')).toBe(true);
                expect(csvService.validateRepeatField('repeat')).toBe(true);
                expect(csvService.validateRepeatField('no-repeat')).toBe(true);
                expect(csvService.validateRepeatField('')).toBe(true); // Optional field
            });

            test('should reject invalid repeat values', () => {
                expect(csvService.validateRepeatField('Maybe')).toBe(false);
                expect(csvService.validateRepeatField('Yes')).toBe(false);
                expect(csvService.validateRepeatField('1')).toBe(false);
            });
        });
    });

    describe('getCsvTemplate', () => {
        test('should return CSV template with headers and example', () => {
            const template = csvService.getCsvTemplate();
            const lines = template.split('\n');
            
            expect(lines).toHaveLength(2);
            expect(lines[0]).toContain('Item Id (Opuzen Code)');
            expect(lines[0]).toContain('Product Name');
            expect(lines[0]).toContain('Color');
            expect(lines[1]).toContain('1354-6543K');
            expect(lines[1]).toContain('Tranquil');
            expect(lines[1]).toContain('Ash');
        });

        test('should include all expected columns', () => {
            const template = csvService.getCsvTemplate();
            const headers = template.split('\n')[0];
            
            csvService.expectedColumns.forEach(column => {
                expect(headers).toContain(column);
            });
        });
    });
});
