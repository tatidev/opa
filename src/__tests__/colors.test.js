const request = require('supertest');

// Mock the models before any imports
const mockColorModel = {
  getAllColors: jest.fn(),
  findById: jest.fn(),
  getItemsByColor: jest.fn()
};

jest.mock('../models/ColorModel', () => {
  return jest.fn().mockImplementation(() => mockColorModel);
});

// Now import the app
const app = require('../index');

describe('Colors API Endpoints', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/colors', () => {
    it('should return all colors with default filters', async () => {
      const mockColors = [
        { id: 1, name: 'Red', hex_code: '#FF0000', active: 'Y' },
        { id: 2, name: 'Blue', hex_code: '#0000FF', active: 'Y' }
      ];

      mockColorModel.getAllColors.mockResolvedValue(mockColors);

      const response = await request(app)
        .get('/api/colors')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockColors,
        count: 2,
        filters: { archived: 'N' }
      });

      expect(mockColorModel.getAllColors).toHaveBeenCalledWith({ archived: 'N' });
    });

    it('should filter colors by name', async () => {
      const mockColors = [
        { id: 1, name: 'Red', hex_code: '#FF0000', active: 'Y' }
      ];

      mockColorModel.getAllColors.mockResolvedValue(mockColors);

      const response = await request(app)
        .get('/api/colors?name=Red')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockColors,
        count: 1,
        filters: { name: 'Red', archived: 'N' }
      });

      expect(mockColorModel.getAllColors).toHaveBeenCalledWith({ name: 'Red', archived: 'N' });
    });

    it('should filter colors by archived status', async () => {
      const mockColors = [
        { id: 3, name: 'Green', hex_code: '#00FF00', active: 'N' }
      ];

      mockColorModel.getAllColors.mockResolvedValue(mockColors);

      const response = await request(app)
        .get('/api/colors?archived=Y')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockColors,
        count: 1,
        filters: { archived: 'Y' }
      });

      expect(mockColorModel.getAllColors).toHaveBeenCalledWith({ archived: 'Y' });
    });

    it('should handle database errors gracefully', async () => {
      mockColorModel.getAllColors.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/colors')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch colors'
      });
    });
  });

  describe('GET /api/colors/:id', () => {
    it('should return a specific color by ID', async () => {
      const mockColor = { id: 1, name: 'Red', hex_code: '#FF0000', active: 'Y' };

      mockColorModel.findById.mockResolvedValue(mockColor);

      const response = await request(app)
        .get('/api/colors/1')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockColor
      });

      expect(mockColorModel.findById).toHaveBeenCalledWith('1');
    });

    it('should return 404 when color is not found', async () => {
      mockColorModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/colors/999')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Color not found'
      });
    });

    it('should handle database errors gracefully', async () => {
      mockColorModel.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/colors/1')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch color'
      });
    });
  });

  describe('GET /api/colors/:id/items', () => {
    it('should return items that use a specific color', async () => {
      const mockItems = [
        { id: 1, product_id: 100, code: 'ITEM-1', color_order: 1 },
        { id: 2, product_id: 101, code: 'ITEM-2', color_order: 1 }
      ];

      mockColorModel.getItemsByColor.mockResolvedValue(mockItems);

      const response = await request(app)
        .get('/api/colors/1/items')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockItems,
        count: 2,
        color_id: 1
      });

      expect(mockColorModel.getItemsByColor).toHaveBeenCalledWith(1);
    });

    it('should handle empty results', async () => {
      mockColorModel.getItemsByColor.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/colors/999/items')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
        count: 0,
        color_id: 999
      });
    });

    it('should handle database errors gracefully', async () => {
      mockColorModel.getItemsByColor.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/colors/1/items')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch items by color'
      });
    });
  });
}); 