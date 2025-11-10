const request = require('supertest');

// Mock the entire routes module to avoid model instantiation issues
const mockProductModel = {
  findAll: jest.fn(),
  findById: jest.fn(),
  getProductInfoForTag: jest.fn(),
  getProductSpecsheet: jest.fn(),
  searchByName: jest.fn().mockResolvedValue([
    {
      description: 'Vendor A - Fabric colorline',
      id: '1-R',
      label: 'Product A'
    },
    {
      description: 'Vendor A - SKU',
      id: '1-item_id',
      label: 'Product A / 123 / Red'
    }
  ])
};

// Mock items
const mockItems = [
  { id: 1, name: 'Item 1', product_id: 1, product_type: 'R' },
  { id: 2, name: 'Item 2', product_id: 1, product_type: 'R' }
];

// Mock the ItemModel
const mockItemModel = {
  getItemDetailsByProductId: jest.fn().mockResolvedValue(mockItems),
  getItemInfoForTag: jest.fn().mockResolvedValue({ product_id: 1, product_name: 'Test Product' }),
  searchItems: jest.fn().mockResolvedValue(mockItems)
};

// Mock the models before any imports
jest.mock('../models/ProductModel', () => {
  return jest.fn().mockImplementation(() => mockProductModel);
});

jest.mock('../models/ItemModel', () => {
  return jest.fn().mockImplementation(() => mockItemModel);
});

// Now import the app
const app = require('../index');

// Mock the ProductModel's searchByName method with more realistic data
mockProductModel.searchByName = jest.fn().mockImplementation((query, options) => {
  const results = [
    {
      description: 'Universal Textile Mills - Fabric colorline',
      id: '6001-R',
      label: 'Catalonia'
    },
    {
      description: 'Universal Textile Mills - SKU',
      id: '32477-item_id',
      label: 'Catalonia / 1974-8790 / Copper'
    },
    {
      description: 'Universal Textile Mills - SKU',
      id: '32478-item_id',
      label: 'Catalonia / 1974-8793 / Pearl'
    }
  ];
  
  // Filter based on options
  if (options?.itemsOnly) {
    return results.filter(item => item.id.includes('item_id'));
  }
  
  if (options?.includeDigital === false) {
    return results.filter(item => !item.description.includes('Digital'));
  }
  
  return results;
});

describe('Products API Endpoints', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/products', () => {
    it('should return all products with default filters', async () => {
      const mockProducts = [
        { id: 1, name: 'Product 1', archived: 'N' },
        { id: 2, name: 'Product 2', archived: 'N' }
      ];

      mockProductModel.findAll.mockResolvedValue(mockProducts);

      const response = await request(app)
        .get('/api/products')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockProducts,
        count: 2,
        filters: { archived: 'N' }
      });

      expect(mockProductModel.findAll).toHaveBeenCalledWith({ archived: 'N' });
    });

    it('should handle database errors gracefully', async () => {
      mockProductModel.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/products')
        .expect('Content-Type', /json/)
        .expect(500);

      // In test environment, message field is not included (only in development)
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch products'
      });
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return a specific product by ID', async () => {
      const mockProduct = { id: 1, name: 'Product 1', archived: 'N' };

      mockProductModel.findById.mockResolvedValue(mockProduct);

      const response = await request(app)
        .get('/api/products/1')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockProduct
      });

      expect(mockProductModel.findById).toHaveBeenCalledWith('1');
    });

    it('should return 404 when product is not found', async () => {
      mockProductModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/products/999')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Product not found'
      });
    });
  });

  describe('GET /api/products/:id/items/:type', () => {
    it('should return items for a product with valid type R', async () => {
      const mockItems = [
        { id: 1, product_id: 1, product_type: 'R', name: 'Item 1' },
        { id: 2, product_id: 1, product_type: 'R', name: 'Item 2' }
      ];

      mockItemModel.getItemDetailsByProductId.mockResolvedValue(mockItems);

      const response = await request(app)
        .get('/api/products/1/items/R')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockItems,
        count: 2,
        product_id: 1,
        product_type: 'R'
      });

      expect(mockItemModel.getItemDetailsByProductId).toHaveBeenCalledWith(1, 'R');
    });

    it('should return 400 for invalid product type', async () => {
      const response = await request(app)
        .get('/api/products/1/items/X')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid product type. Must be R (Regular) or D (Digital)'
      });

      expect(mockItemModel.getItemDetailsByProductId).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/products/search/items', () => {
    it('should return items for a product', async () => {
      // Mock request with product ID and type
      const response = await request(app)
        .post('/api/products/search/items')
        .send({
          product_id: '1',
          product_type: 'R'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tableData');
      expect(response.body).toHaveProperty('product_type', 'R');
      expect(response.body).toHaveProperty('product_id', '1');
    });

    it('should return item details for an item ID', async () => {
      // Mock request with item ID
      const response = await request(app)
        .post('/api/products/search/items')
        .send({
          item_id: '1',
          product_type: 'item_id'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tableData');
    });
  });

  describe('POST /api/products/typeahead_products_list', () => {
    it('should return typeahead search results', async () => {
      const response = await request(app)
        .post('/api/products/typeahead_products_list')
        .send({
          query: 'Catalonia'
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('description');
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('label');
      
      // Verify the structure matches legacy output
      const firstItem = response.body[0];
      expect(firstItem.description).toContain(' - '); // Check format
      expect(firstItem.id).toMatch(/^\d+-[A-Z]$/); // Product ID format
      expect(typeof firstItem.label).toBe('string');
    });

    it('should return only items when itemsOnly is true', async () => {
      const response = await request(app)
        .post('/api/products/typeahead_products_list')
        .send({
          query: 'Catalonia',
          itemsOnly: true
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // All results should be items (not products)
      response.body.forEach(item => {
        expect(item.id).toContain('item_id');
      });
    });

    it('should exclude digital products when includeDigital is false', async () => {
      const response = await request(app)
        .post('/api/products/typeahead_products_list')
        .send({
          query: 'Catalonia',
          includeDigital: false
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // No results should contain "Digital" in the description
      response.body.forEach(item => {
        expect(item.description).not.toContain('Digital');
      });
    });

    it('should return empty array for empty query', async () => {
      const response = await request(app)
        .post('/api/products/typeahead_products_list')
        .send({
          query: ''
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });
}); 