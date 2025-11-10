const request = require('supertest');

// Mock the models before any imports
const mockItemModel = {
  findById: jest.fn(),
  getItemDetails: jest.fn(),
  getItemInfoForTag: jest.fn()
};

const mockColorModel = {
  getItemColors: jest.fn(),
  addItemColor: jest.fn(),
  removeItemColor: jest.fn()
};

jest.mock('../models/ItemModel', () => {
  return jest.fn().mockImplementation(() => mockItemModel);
});

jest.mock('../models/ColorModel', () => {
  return jest.fn().mockImplementation(() => mockColorModel);
});

// Now import the app
const app = require('../index');

describe('Items API Endpoints', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/items/:id', () => {
    it('should return a specific item by ID with provided type', async () => {
      const mockItem = { 
        id: 123, 
        product_id: 456, 
        product_type: 'R', 
        code: 'ITEM-123' 
      };

      mockItemModel.getItemDetails.mockResolvedValue(mockItem);

      const response = await request(app)
        .get('/api/items/123?type=R')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockItem,
        item_id: 123,
        product_type: 'R'
      });

      expect(mockItemModel.getItemDetails).toHaveBeenCalledWith(123, 'R');
    });

    it('should determine product type automatically if not provided', async () => {
      const mockBasicItem = { 
        id: 123, 
        product_id: 456, 
        product_type: 'D'
      };
      
      const mockItem = { 
        id: 123, 
        product_id: 456, 
        product_type: 'D', 
        code: 'ITEM-123' 
      };

      mockItemModel.findById.mockResolvedValue(mockBasicItem);
      mockItemModel.getItemDetails.mockResolvedValue(mockItem);

      const response = await request(app)
        .get('/api/items/123')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockItem,
        item_id: 123,
        product_type: 'D'
      });

      expect(mockItemModel.findById).toHaveBeenCalledWith('123');
      expect(mockItemModel.getItemDetails).toHaveBeenCalledWith(123, 'D');
    });

    it('should return 400 for invalid product type', async () => {
      const response = await request(app)
        .get('/api/items/123?type=X')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid product type. Must be R (Regular) or D (Digital)'
      });

      expect(mockItemModel.getItemDetails).not.toHaveBeenCalled();
    });

    it('should return 404 when item is not found', async () => {
      mockItemModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/items/999')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Item not found'
      });
    });

    it('should handle database errors gracefully', async () => {
      mockItemModel.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/items/123')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch item'
      });
    });
  });

  describe('GET /api/items/:id/info/:type', () => {
    it('should return item info for tag display', async () => {
      const mockItemInfo = { 
        item_id: 123, 
        product_id: 456, 
        product_name: 'Test Product', 
        code: 'ITEM-123' 
      };

      mockItemModel.getItemInfoForTag.mockResolvedValue(mockItemInfo);

      const response = await request(app)
        .get('/api/items/123/info/R')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockItemInfo,
        item_id: 123,
        product_type: 'R'
      });

      expect(mockItemModel.getItemInfoForTag).toHaveBeenCalledWith('R', 123);
    });

    it('should return 400 for invalid product type', async () => {
      const response = await request(app)
        .get('/api/items/123/info/X')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid product type. Must be R (Regular) or D (Digital)'
      });

      expect(mockItemModel.getItemInfoForTag).not.toHaveBeenCalled();
    });

    it('should return 404 when item info is not found', async () => {
      mockItemModel.getItemInfoForTag.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/items/999/info/R')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Item not found'
      });
    });

    it('should handle database errors gracefully', async () => {
      mockItemModel.getItemInfoForTag.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/items/123/info/R')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch item info'
      });
    });
  });

  describe('GET /api/items/:id/colors', () => {
    it('should return colors for an item', async () => {
      const mockColors = [
        { id: 1, name: 'Red', hex_code: '#FF0000', active: 'Y' },
        { id: 2, name: 'Blue', hex_code: '#0000FF', active: 'Y' }
      ];

      mockColorModel.getItemColors.mockResolvedValue(mockColors);

      const response = await request(app)
        .get('/api/items/123/colors')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockColors,
        count: 2,
        item_id: 123
      });

      expect(mockColorModel.getItemColors).toHaveBeenCalledWith(123);
    });

    it('should handle database errors gracefully', async () => {
      mockColorModel.getItemColors.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/items/123/colors')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch item colors'
      });
    });
  });

  describe('POST /api/items/:id/colors', () => {
    it('should add a color to an item', async () => {
      const mockResult = [
        { id: 1, name: 'Red', hex_code: '#FF0000', active: 'Y' },
        { id: 2, name: 'Blue', hex_code: '#0000FF', active: 'Y' }
      ];

      mockColorModel.addItemColor.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/items/123/colors')
        .send({ color_id: 2, n_order: 2 })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: mockResult,
        item_id: 123,
        color_id: 2
      });

      expect(mockColorModel.addItemColor).toHaveBeenCalledWith(123, 2, 2);
    });

    it('should return 400 when color_id is missing', async () => {
      const response = await request(app)
        .post('/api/items/123/colors')
        .send({ n_order: 2 })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'color_id is required'
      });

      expect(mockColorModel.addItemColor).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockColorModel.addItemColor.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/items/123/colors')
        .send({ color_id: 2 })
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to add item color'
      });
    });
  });

  describe('DELETE /api/items/:id/colors/:colorId', () => {
    it('should remove a color from an item', async () => {
      mockColorModel.removeItemColor.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/items/123/colors/2')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Color removed from item',
        item_id: 123,
        color_id: 2
      });

      expect(mockColorModel.removeItemColor).toHaveBeenCalledWith(123, 2);
    });

    it('should return 404 when color is not found for the item', async () => {
      mockColorModel.removeItemColor.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/items/123/colors/999')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Color not found for this item'
      });

      expect(mockColorModel.removeItemColor).toHaveBeenCalledWith(123, 999);
    });

    it('should handle database errors gracefully', async () => {
      mockColorModel.removeItemColor.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/items/123/colors/2')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to remove item color'
      });
    });
  });
}); 