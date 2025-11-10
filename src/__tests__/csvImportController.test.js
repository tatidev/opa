/**
 * Tests for CSV Import Controller
 * Tests CSV import endpoints and functionality
 */

const CsvImportController = require('../controllers/CsvImportController');
const CsvImportService = require('../services/csvImportService');
const CsvDataTransformationService = require('../services/csvDataTransformationService');
const ImportJobModel = require('../models/ImportJobModel');
const ImportItemModel = require('../models/ImportItemModel');

// Mock dependencies
jest.mock('../services/csvImportService');
jest.mock('../services/csvDataTransformationService');
jest.mock('../models/ImportJobModel');
jest.mock('../models/ImportItemModel');

describe('CsvImportController', () => {
    let controller;
    let mockReq;
    let mockRes;
    let mockCsvService;
    let mockTransformationService;
    let mockImportJobModel;
    let mockImportItemModel;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create controller instance
        controller = new CsvImportController();

        // Get mocked services from the controller instance
        mockCsvService = controller.csvService;
        mockTransformationService = controller.transformationService;
        mockImportJobModel = controller.importJobModel;
        mockImportItemModel = controller.importItemModel;

        // Mock request object
        mockReq = {
            file: {
                originalname: 'test.csv',
                size: 1024,
                mimetype: 'text/csv',
                buffer: Buffer.from('test csv content')
            },
            user: { id: 1 },
            params: {},
            query: {}
        };

        // Mock response object
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            setHeader: jest.fn().mockReturnThis()
        };
    });

    describe('uploadCsv', () => {
        test('should handle CSV upload successfully', async () => {
            // Mock CSV parsing
            const mockCsvData = [
                {
                    'Item Id (Opuzen Code)': 'ABC123',
                    'Product Name': 'Tranquil',
                    'Color': 'Ash'
                }
            ];

            mockCsvService.parseCsvBuffer.mockResolvedValue(mockCsvData);
            mockCsvService.validateCsvData.mockReturnValue({
                isValid: true,
                summary: {
                    totalRows: 1,
                    validRows: 1,
                    invalidRows: 0
                },
                warnings: []
            });

            // Mock transformation
            mockTransformationService.transformCsvRow.mockReturnValue({
                rowNumber: 1,
                operations: [],
                errors: [],
                warnings: []
            });

            // Mock import job creation
            mockImportJobModel.create.mockResolvedValue({
                id: 1,
                job_uuid: 'job_123',
                status: 'pending'
            });

            // Mock import item creation
            mockImportItemModel.bulkCreate.mockResolvedValue([]);

            // Mock job update
            mockImportJobModel.update.mockResolvedValue({});

            await controller.uploadCsv(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: 'CSV import job created and processing started'
                })
            );

            expect(mockCsvService.parseCsvBuffer).toHaveBeenCalledWith(mockReq.file.buffer);
            expect(mockCsvService.validateCsvData).toHaveBeenCalledWith(mockCsvData);
            expect(mockImportJobModel.create).toHaveBeenCalled();
        });

        test('should reject request without file', async () => {
            mockReq.file = null;

            await controller.uploadCsv(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'No CSV file provided'
            });
        });

        test('should reject non-CSV files', async () => {
            mockReq.file.mimetype = 'application/json';
            mockReq.file.originalname = 'test.json';

            await controller.uploadCsv(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'File must be a CSV file'
            });
        });

        test('should handle empty CSV data', async () => {
            mockCsvService.parseCsvBuffer.mockResolvedValue([]);

            await controller.uploadCsv(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'CSV file is empty or contains no data rows'
            });
        });

        test('should handle CSV validation failure', async () => {
            const mockCsvData = [
                {
                    'Item Id (Opuzen Code)': 'ABC123',
                    'Product Name': 'Tranquil',
                    'Color': 'Ash'
                }
            ];

            mockCsvService.parseCsvBuffer.mockResolvedValue(mockCsvData);
            mockCsvService.validateCsvData.mockReturnValue({
                isValid: false,
                errors: ['Validation error'],
                summary: {
                    totalRows: 1,
                    validRows: 0,
                    invalidRows: 1
                }
            });

            await controller.uploadCsv(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'CSV validation failed',
                validation: expect.any(Object)
            });
        });

        test('should handle transformation errors', async () => {
            const mockCsvData = [
                {
                    'Item Id (Opuzen Code)': 'ABC123',
                    'Product Name': 'Tranquil',
                    'Color': 'Ash'
                }
            ];

            mockCsvService.parseCsvBuffer.mockResolvedValue(mockCsvData);
            mockCsvService.validateCsvData.mockReturnValue({
                isValid: true,
                summary: {
                    totalRows: 1,
                    validRows: 1,
                    invalidRows: 0
                },
                warnings: []
            });

            // Mock transformation with errors
            mockTransformationService.transformCsvRow.mockReturnValue({
                rowNumber: 1,
                operations: [],
                errors: ['Transformation error'],
                warnings: []
            });

            mockImportJobModel.create.mockResolvedValue({
                id: 1,
                job_uuid: 'job_123',
                status: 'pending'
            });

            mockImportItemModel.bulkCreate.mockResolvedValue([]);
            mockImportJobModel.update.mockResolvedValue({});

            await controller.uploadCsv(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    job: expect.objectContaining({
                        failedItems: 1
                    })
                })
            );
        });

        test('should handle service errors gracefully', async () => {
            mockCsvService.parseCsvBuffer.mockRejectedValue(new Error('Service error'));

            await controller.uploadCsv(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Internal server error during CSV import',
                details: 'Service error'
            });
        });
    });

    describe('getCsvTemplate', () => {
        test('should return CSV template', async () => {
            const mockTemplate = 'header1,header2\nvalue1,value2';
            mockCsvService.getCsvTemplate.mockReturnValue(mockTemplate);

            await controller.getCsvTemplate(mockReq, mockRes);

            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
            expect(mockRes.setHeader).toHaveBeenCalledWith(
                'Content-Disposition',
                'attachment; filename="opms-import-template.csv"'
            );
            expect(mockRes.send).toHaveBeenCalledWith(mockTemplate);
        });

        test('should handle template generation errors', async () => {
            mockCsvService.getCsvTemplate.mockImplementation(() => {
                throw new Error('Template error');
            });

            await controller.getCsvTemplate(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to generate CSV template'
            });
        });
    });

    describe('getImportJobStatus', () => {
        test('should return job status successfully', async () => {
            const mockJob = {
                id: 1,
                job_uuid: 'job_123',
                status: 'pending',
                original_filename: 'test.csv',
                total_items: 5,
                items_processed: 0,
                items_succeeded: 0,
                items_failed_permanent: 0,
                items_failed_retryable: 0,
                created_at: new Date(),
                started_at: null,
                completed_at: null
            };

            const mockItems = [
                { status: 'pending' },
                { status: 'pending' },
                { status: 'success' },
                { status: 'failed_permanent' },
                { status: 'failed_retryable' }
            ];

            mockImportJobModel.findById.mockResolvedValue(mockJob);
            mockImportItemModel.findByJobId.mockResolvedValue(mockItems);

            await controller.getImportJobStatus(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    job: expect.objectContaining({
                        id: 1,
                        status: 'pending'
                    }),
                    status: expect.objectContaining({
                        total: 5,
                        pending: 2,
                        success: 1,
                        failed_permanent: 1,
                        failed_retryable: 1
                    })
                })
            );
        });

        test('should handle job not found', async () => {
            mockImportJobModel.findById.mockResolvedValue(null);

            await controller.getImportJobStatus(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Import job not found'
            });
        });
    });

    describe('listImportJobs', () => {
        test('should return list of import jobs', async () => {
            const mockJobs = [
                { id: 1, status: 'pending' },
                { id: 2, status: 'completed' }
            ];

            mockImportJobModel.findAll.mockResolvedValue(mockJobs);

            await controller.listImportJobs(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                jobs: mockJobs,
                pagination: {
                    limit: 50,
                    offset: 0,
                    total: 2
                }
            });
        });

        test('should handle query parameters', async () => {
            mockReq.query = { status: 'pending', limit: '10', offset: '5' };

            const mockJobs = [{ id: 1, status: 'pending' }];
            mockImportJobModel.findAll.mockResolvedValue(mockJobs);

            await controller.listImportJobs(mockReq, mockRes);

            expect(mockImportJobModel.findAll).toHaveBeenCalledWith({
                status: 'pending',
                limit: 10,
                offset: 5
            });
        });
    });

    describe('cancelImportJob', () => {
        test('should cancel job successfully', async () => {
            mockReq.params.jobId = '1';

            const mockJob = {
                id: 1,
                status: 'pending'
            };

            mockImportJobModel.findById.mockResolvedValue(mockJob);
            mockImportJobModel.update.mockResolvedValue({});

            await controller.cancelImportJob(mockReq, mockRes);

            expect(mockImportJobModel.update).toHaveBeenCalledWith("1", {
                status: 'cancelled',
                completed_at: expect.any(Date)
            });

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Import job cancelled successfully',
                job: { id: 1, status: 'cancelled' }
            });
        });

        test('should not cancel completed job', async () => {
            mockReq.params.jobId = '1';

            const mockJob = {
                id: 1,
                status: 'completed'
            };

            mockImportJobModel.findById.mockResolvedValue(mockJob);

            await controller.cancelImportJob(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Cannot cancel job with status: completed'
            });
        });
    });

    describe('getImportJobDetails', () => {
        test('should return job details with items', async () => {
            mockReq.params.jobId = '1';
            mockReq.query = { limit: '50', offset: '0' };

            const mockJob = {
                id: 1,
                job_uuid: 'job_123',
                status: 'pending',
                original_filename: 'test.csv',
                total_items: 3,
                created_at: new Date()
            };

            const mockItems = [
                {
                    id: 1,
                    opms_item_code: 'ABC123',
                    status: 'pending',
                    csv_row_number: 1,
                    last_error_message: null,
                    first_attempted_at: null,
                    last_attempted_at: null,
                    succeeded_at: null
                }
            ];

            mockImportJobModel.findById.mockResolvedValue(mockJob);
            mockImportItemModel.findByJobId.mockResolvedValue(mockItems);

            await controller.getImportJobDetails(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                job: expect.objectContaining({
                    id: 1,
                    status: 'pending'
                }),
                items: expect.arrayContaining([
                    expect.objectContaining({
                        opms_item_code: 'ABC123',
                        status: 'pending'
                    })
                ]),
                pagination: {
                    limit: 50,
                    offset: 0,
                    total: 1
                }
            });
        });
    });

    describe('generateJobUuid', () => {
        test('should generate unique job UUIDs', () => {
            const uuid1 = controller.generateJobUuid();
            const uuid2 = controller.generateJobUuid();

            expect(uuid1).toMatch(/^job_\d+_[a-z0-9]+$/);
            expect(uuid2).toMatch(/^job_\d+_[a-z0-9]+$/);
            expect(uuid1).not.toBe(uuid2);
        });
    });
});
