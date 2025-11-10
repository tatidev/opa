/**
 * Tests for Import Routes
 * Tests that import routes are properly mounted and accessible
 */

const request = require('supertest');
const app = require('../index');

describe('Import Routes', () => {
    describe('GET /api/import/csv/template', () => {
        test('should return CSV template', async () => {
            const response = await request(app)
                .get('/api/import/csv/template')
                .expect(200);

            expect(response.headers['content-type']).toContain('text/csv');
            expect(response.headers['content-disposition']).toContain('opms-import-template.csv');
            expect(response.text).toContain('Item Id (Opuzen Code)');
            expect(response.text).toContain('Product Name');
            expect(response.text).toContain('Color');
        });
    });

    describe('POST /api/import/csv', () => {
        test('should require authentication', async () => {
            const response = await request(app)
                .post('/api/import/csv')
                .expect(401);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/import/jobs', () => {
        test('should require authentication', async () => {
            const response = await request(app)
                .get('/api/import/jobs')
                .expect(401);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/import/jobs/:jobId', () => {
        test('should require authentication', async () => {
            const response = await request(app)
                .get('/api/import/jobs/1')
                .expect(401);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/import/jobs/:jobId/details', () => {
        test('should require authentication', async () => {
            const response = await request(app)
                .get('/api/import/jobs/1/details')
                .expect(401);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('POST /api/import/jobs/:jobId/cancel', () => {
        test('should require authentication', async () => {
            const response = await request(app)
                .post('/api/import/jobs/1/cancel')
                .expect(401);

            expect(response.body.error).toBeDefined();
        });
    });
});
