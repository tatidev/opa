const swaggerJsdoc = require('swagger-jsdoc');

/**
 * Swagger configuration
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Opuzen API Documentation v1.1.0',
      version: '1.1.0',
      description: 'API documentation for Opuzen application',
      contact: {
        name: 'Opuzen Support',
        url: 'https://opuzen.com',
        email: 'support@opuzen.com'
      },
      license: {
        name: 'Proprietary',
        url: 'https://opuzen.com/terms'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.opuzen.com',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Product ID' },
            name: { type: 'string', description: 'Product name' },
            description: { type: 'string', description: 'Product description' },
            type: { type: 'string', enum: ['R', 'D'], description: 'Product type (R=Regular, D=Digital)' },
            archived: { type: 'string', enum: ['Y', 'N'], description: 'Whether product is archived' }
          }
        },
        Item: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Item ID' },
            product_id: { type: 'integer', description: 'Associated product ID' },
            product_type: { type: 'string', enum: ['R', 'D'], description: 'Product type (R=Regular, D=Digital)' },
            name: { type: 'string', description: 'Item name' },
            description: { type: 'string', description: 'Item description' },
            sku: { type: 'string', description: 'SKU' },
            price: { type: 'number', description: 'Item price' },
            stock: { type: 'integer', description: 'Stock quantity' },
            archived: { type: 'string', enum: ['Y', 'N'], description: 'Whether item is archived' }
          }
        },
        Color: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Color ID' },
            name: { type: 'string', description: 'Color name' },
            color_code: { type: 'string', description: 'Color code' },
            archived: { type: 'string', enum: ['Y', 'N'], description: 'Whether color is archived' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', description: 'Error type' },
            message: { type: 'string', description: 'Error message' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object', description: 'Response data' }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    tags: [
      { name: 'Products', description: 'Product management endpoints' },
      { name: 'Items', description: 'Item management endpoints' },
      { name: 'Colors', description: 'Color management endpoints' },
      { name: 'Export', description: 'CSV export endpoints for OPMS to NetSuite' },
      { name: 'Import', description: 'CSV import and job management endpoints' },
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'User Management', description: 'User management endpoints' },
      { name: 'Showroom Management', description: 'Showroom management endpoints' },
      { name: 'NS to OPMS Sync', description: 'NetSuite to OPMS synchronization endpoints' },
      { name: 'System', description: 'System and health check endpoints' }
    ]
  },
  apis: [
    './src/routes/*.js', 
    './src/controllers/*.js'
  ], // Path to the API routes and controllers
};

const specs = swaggerJsdoc(options);

module.exports = specs; 