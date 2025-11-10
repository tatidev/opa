const request = require('supertest');
const app = require('../index');
const UserModel = require('../models/UserModel');
const jwt = require('../utils/jwt');

describe('Authentication Endpoints', () => {
    let userModel;
    let testUser;

    beforeAll(async () => {
        userModel = new UserModel();
        
        // Create test user
        testUser = await userModel.createUser({
            username: 'testuser',
            email: 'test@example.com',
            password: 'testpassword123',
            first_name: 'Test',
            last_name: 'User'
        });
    });

    afterAll(async () => {
        // Clean up test user
        if (testUser) {
            await userModel.deleteUser(testUser.id);
        }
    });

    describe('POST /api/auth/login', () => {
        test('should login with valid username and password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: 'testuser',
                    password: 'testpassword123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.username).toBe('testuser');
            expect(response.body.data.tokens.accessToken).toBeDefined();
            expect(response.body.data.tokens.refreshToken).toBeDefined();
        });

        test('should login with valid email and password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: 'test@example.com',
                    password: 'testpassword123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe('test@example.com');
        });

        test('should fail with invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: 'testuser',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid credentials');
        });

        test('should fail with missing fields', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: 'testuser'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Validation failed');
        });

        test('should fail with nonexistent user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: 'nonexistent',
                    password: 'testpassword123'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid credentials');
        });
    });

    describe('POST /api/auth/refresh', () => {
        let refreshToken;

        beforeAll(async () => {
            // Get a refresh token
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: 'testuser',
                    password: 'testpassword123'
                });

            refreshToken = loginResponse.body.data.tokens.refreshToken;
        });

        test('should refresh token with valid refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: refreshToken
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();
            expect(response.body.data.refreshToken).toBeDefined();
        });

        test('should fail with invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: 'invalid_token'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid refresh token');
        });

        test('should fail with missing refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Refresh token required');
        });
    });

    describe('POST /api/auth/logout', () => {
        test('should logout successfully', async () => {
            const response = await request(app)
                .post('/api/auth/logout');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Logout successful');
        });
    });

    describe('GET /api/auth/me', () => {
        let accessToken;

        beforeAll(async () => {
            // Get an access token
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: 'testuser',
                    password: 'testpassword123'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
        });

        test('should get user profile with valid token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.username).toBe('testuser');
            expect(response.body.data.email).toBe('test@example.com');
        });

        test('should fail without token', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Authentication required');
        });

        test('should fail with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid_token');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid token');
        });
    });

    describe('Rate Limiting', () => {
        test('should rate limit login attempts', async () => {
            const promises = [];
            
            // Make 10 failed login attempts
            for (let i = 0; i < 10; i++) {
                promises.push(
                    request(app)
                        .post('/api/auth/login')
                        .send({
                            identifier: 'testuser',
                            password: 'wrongpassword'
                        })
                );
            }

            const responses = await Promise.all(promises);
            
            // Some requests should be rate limited
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('Account Locking', () => {
        let lockTestUser;

        beforeAll(async () => {
            // Create a user specifically for lock testing
            lockTestUser = await userModel.createUser({
                username: 'locktestuser',
                email: 'locktest@example.com',
                password: 'testpassword123',
                first_name: 'Lock',
                last_name: 'Test'
            });
        });

        afterAll(async () => {
            if (lockTestUser) {
                await userModel.deleteUser(lockTestUser.id);
            }
        });

        test('should lock account after failed attempts', async () => {
            // Make 5 failed login attempts
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/api/auth/login')
                    .send({
                        identifier: 'locktestuser',
                        password: 'wrongpassword'
                    });
            }

            // Next attempt should be locked
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: 'locktestuser',
                    password: 'testpassword123'
                });

            expect(response.status).toBe(423);
            expect(response.body.error).toBe('Account locked');
        });
    });
}); 