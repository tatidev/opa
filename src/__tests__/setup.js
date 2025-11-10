// Test environment setup
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test_db';

// SECURITY: JWT_SECRET required for authentication tests
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests-only-min-32-chars';

// SECURITY: CORS_ORIGIN required for application startup
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Mock the database connection for all tests
jest.mock('../db', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  testConnection: jest.fn().mockResolvedValue(true),
  query: jest.fn().mockResolvedValue([[], []]),
  execute: jest.fn().mockResolvedValue({ insertId: 1, affectedRows: 1 }),
  transaction: jest.fn().mockImplementation(async (callback) => {
    const mockConnection = {
      query: jest.fn().mockResolvedValue([[], []]),
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn().mockResolvedValue()
    };
    return await callback(mockConnection);
  }),
  pool: {
    query: jest.fn().mockResolvedValue([[], []])
  },
  end: jest.fn().mockResolvedValue(true)
}));

// Mock the config/database module
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn().mockResolvedValue([[], []]),
    getConnection: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue([[], []]),
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn().mockResolvedValue()
    })
  },
  testConnection: jest.fn().mockResolvedValue(true),
  query: jest.fn().mockResolvedValue([[], []]),
  transaction: jest.fn().mockImplementation(async (callback) => {
    const mockConnection = {
      query: jest.fn().mockResolvedValue([[], []]),
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn().mockResolvedValue()
    };
    return await callback(mockConnection);
  }),
  config: {
    host: 'localhost',
    user: 'test',
    database: 'test_db'
  }
}));

// Mock logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Ensure NODE_ENV is set to test
global.process.env.NODE_ENV = 'test'; 