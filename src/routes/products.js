import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// Public routes - no auth required
router.get('/', async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort = 'newest', page = 1, limit = 12 } = req.query;
    
    let query = { isActive: true };
    
    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Search by name, description, or fullDescription
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { fullDescription: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    // Sort options
    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'price-low': sortOption = { price: 1 }; break;
      case 'price-high': sortOption = { price: -1 }; break;
      case 'name': sortOption = { name: 1 }; break;
      case 'rating': sortOption = { rating: -1 }; break;
      case 'newest': sortOption = { createdAt: -1 }; break;
      default: sortOption = { createdAt: -1 }; break;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query)
    ]);
    
    res.json({
      products,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get featured products
router.get('/featured', async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    const featured = await Product.find({ 
      isActive: true,
      $or: [
        { rating: { $gte: 4 } },
        { discount: { $gt: 0 } }
      ]
    })
      .populate('category', 'name')
      .sort({ rating: -1, createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(featured);
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single product (public)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    
    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin routes - require authentication and admin role
router.use(requireAuth, requireAdmin);

// Create product (admin only) 
router.post('/',
  [
    body('name').isString().trim().isLength({ min: 2, max: 200 }).withMessage('Name must be 2-200 characters'),
    body('description').optional().isString().trim().isLength({ max: 500 }).withMessage('Description max 500 characters'),
    body('fullDescription').optional().isString().trim().isLength({ max: 5000 }).withMessage('Full description max 5000 characters'),
    body('images').isArray().withMessage('Images must be an array'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
    body('originalPrice').optional().isFloat({ min: 0 }).withMessage('Original price must be a positive number'),
    body('discount').optional().isInt({ min: 0, max: 100 }).withMessage('Discount must be 0-100'),
    body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
    body('reviews').optional().isInt({ min: 0 }).withMessage('Reviews must be a positive integer'),
    body('inStock').isBoolean().withMessage('inStock must be boolean'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('category').optional().isMongoId().withMessage('Category must be a valid ID'),
    body('ingredients').optional().isArray().withMessage('Ingredients must be an array'),
    body('benefits').optional().isArray().withMessage('Benefits must be an array'),
    body('howToUse').optional().isArray().withMessage('How to use must be an array'),
    body('specifications').optional().isObject().withMessage('Specifications must be an object')
  ],
  async (req, res) => {
    console.log('Create product request received:', req.body); // Debug log
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array()); // Debug log
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array().map(err => `${err.path}: ${err.msg}`).join(', ')
      });
    }

    try {
      let productData = { ...req.body };
      
      // Validate category if provided
      if (productData.category) {
        const categoryExists = await Category.findById(productData.category);
        if (!categoryExists) {
          return res.status(400).json({ message: 'Invalid category ID' });
        }
      }
      
      // Data type conversions and cleaning
      if (productData.name) productData.name = productData.name.trim();
      if (productData.description) productData.description = productData.description.trim();
      if (productData.fullDescription) productData.fullDescription = productData.fullDescription.trim();
      
      // Convert string numbers to proper numbers
      if (typeof productData.price === 'string') {
        productData.price = parseFloat(productData.price.replace(/[^\d.]/g, ''));
      }
      if (typeof productData.originalPrice === 'string') {
        productData.originalPrice = parseFloat(productData.originalPrice.replace(/[^\d.]/g, ''));
      }
      if (typeof productData.discount === 'string') {
        const match = productData.discount.match(/\d+/);
        productData.discount = match ? parseInt(match[0], 10) : 0;
      }
      if (typeof productData.rating === 'string') {
        productData.rating = parseFloat(productData.rating);
      }
      if (typeof productData.reviews === 'string') {
        productData.reviews = parseInt(productData.reviews, 10);
      }
      if (typeof productData.stock === 'string') {
        productData.stock = parseInt(productData.stock, 10);
      }
      
      // Convert string booleans to proper booleans
      if (typeof productData.inStock === 'string') {
        productData.inStock = productData.inStock === 'true';
      }
      
      // Ensure arrays are properly formatted
      ['images', 'ingredients', 'benefits', 'howToUse'].forEach(field => {
        if (productData[field] && !Array.isArray(productData[field])) {
          productData[field] = [productData[field]];
        }
      });
      
      // Handle specifications object
      if (typeof productData.specifications === 'string') {
        try {
          productData.specifications = JSON.parse(productData.specifications);
        } catch {
          productData.specifications = {};
        }
      }
      
      // Set default values
      productData.isActive = productData.isActive ?? true;
      
      console.log('Processed product data:', productData); // Debug log
      
      const product = await Product.create(productData);
      
      // Populate category for response
      await product.populate('category', 'name');
      
      console.log('Product created successfully:', product._id); // Debug log
      
      res.status(201).json(product)
    } catch (error) {
      console.error('Create product error:', error);
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: 'Validation failed', errors: messages.join(', ') });
      }
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Update product (admin only)
router.put('/:id',
  [
    body('name').optional().isString().trim().isLength({ min: 2, max: 200 }).withMessage('Name must be 2-200 characters'),
    body('description').optional().isString().trim().isLength({ max: 500 }).withMessage('Description max 500 characters'),
    body('fullDescription').optional().isString().trim().isLength({ max: 5000 }).withMessage('Full description max 5000 characters'),
    body('images').optional().isArray().withMessage('Images must be an array'),
    body('price').optional().isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
    body('originalPrice').optional().isFloat({ min: 0 }).withMessage('Original price must be a positive number'),
    body('discount').optional().isInt({ min: 0, max: 100 }).withMessage('Discount must be 0-100'),
    body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
    body('reviews').optional().isInt({ min: 0 }).withMessage('Reviews must be a positive integer'),
    body('inStock').optional().isBoolean().withMessage('inStock must be boolean'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('category').optional().isMongoId().withMessage('Category must be a valid ID'),
    body('ingredients').optional().isArray().withMessage('Ingredients must be an array'),
    body('benefits').optional().isArray().withMessage('Benefits must be an array'),
    body('howToUse').optional().isArray().withMessage('How to use must be an array'),
    body('specifications').optional().isObject().withMessage('Specifications must be an object')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array().map(err => `${err.path}: ${err.msg}`).join(', ')
      });
    }

    try {
      let updateData = { ...req.body };
      
      // Validate category if provided
      if (updateData.category) {
        const categoryExists = await Category.findById(updateData.category);
        if (!categoryExists) {
          return res.status(400).json({ message: 'Invalid category ID' });
        }
      }
      
      // Clean up string fields
      if (updateData.name) updateData.name = updateData.name.trim();
      if (updateData.description) updateData.description = updateData.description.trim();
      if (updateData.fullDescription) updateData.fullDescription = updateData.fullDescription.trim();
      
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate('category', 'name');
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Update product error:', error);
      if (error.name === 'CastError') {
        return res.status(400).json({ message: 'Invalid product ID' });
      }
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: 'Validation failed', errors: messages.join(', ') });
      }
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Delete product (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await Product.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk operations for admin efficiency
router.patch('/bulk-status',
  [
    body('productIds').isArray().withMessage('Product IDs must be an array'),
    body('productIds.*').isMongoId().withMessage('Each product ID must be valid'),
    body('isActive').isBoolean().withMessage('isActive must be boolean')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array().map(err => err.msg).join(', ')
      });
    }

    try {
      const { productIds, isActive } = req.body;
      
      const result = await Product.updateMany(
        { _id: { $in: productIds } },
        { isActive }
      );
      
      res.json({ 
        message: `Updated ${result.modifiedCount} products`,
        modified: result.modifiedCount 
      });
    } catch (error) {
      console.error('Bulk status update error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.patch('/bulk-category',
  [
    body('productIds').isArray().withMessage('Product IDs must be an array'),
    body('productIds.*').isMongoId().withMessage('Each product ID must be valid'),
    body('category').optional().isMongoId().withMessage('Category must be a valid ID')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array().map(err => err.msg).join(', ')
      });
    }

    try {
      const { productIds, category } = req.body;
      
      // Validate category if provided
      if (category) {
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
          return res.status(400).json({ message: 'Invalid category ID' });
        }
      }
      
      const result = await Product.updateMany(
        { _id: { $in: productIds } },
        { category: category || null }
      );
      
      res.json({ 
        message: `Updated ${result.modifiedCount} products`,
        modified: result.modifiedCount 
      });
    } catch (error) {
      console.error('Bulk category update error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

export default router;