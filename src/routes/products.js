import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Product from '../models/Product.js';
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
    
    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
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
      case 'newest': sortOption = { createdAt: -1 }; break;
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const featured = await Product.find({ isActive: true })
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(8);
    res.json(featured);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin routes - require auth
router.post('/', requireAuth, requireAdmin,
  body('name').isString().isLength({ min: 2 }),
  body('price').optional(),
  body('originalPrice').optional(),
  body('discount').optional(),
  body('stock').optional(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      let {
        name,
        description,
        fullDescription,
        images,
        price,
        originalPrice,
        discount,
        rating,
        reviews,
        inStock,
        category,
        ingredients,
        benefits,
        howToUse,
        specifications,
        stock,
        isActive
      } = req.body;

      // Convert price fields to numbers (strip currency if needed)
      if (typeof price === 'string') price = parseFloat(price.replace(/[^\d.]/g, ''));
      if (typeof originalPrice === 'string') originalPrice = parseFloat(originalPrice.replace(/[^\d.]/g, ''));
      // Convert discount to number (strip % and text)
      if (typeof discount === 'string') {
        const match = discount.match(/\d+/);
        discount = match ? parseInt(match[0], 10) : undefined;
      }
      // Convert rating/reviews/stock to numbers
      if (typeof rating === 'string') rating = parseFloat(rating);
      if (typeof reviews === 'string') reviews = parseInt(reviews, 10);
      if (typeof stock === 'string') stock = parseInt(stock, 10);
      // Convert inStock/isActive to boolean
      if (typeof inStock === 'string') inStock = inStock === 'true' || inStock === true;
      if (typeof isActive === 'string') isActive = isActive === 'true' || isActive === true;
      // Ensure arrays
      if (images && !Array.isArray(images)) images = [images];
      if (ingredients && !Array.isArray(ingredients)) ingredients = [ingredients];
      if (benefits && !Array.isArray(benefits)) benefits = [benefits];
      if (howToUse && !Array.isArray(howToUse)) howToUse = [howToUse];
      // Ensure specifications is an object/map
      if (typeof specifications === 'string') {
        try { specifications = JSON.parse(specifications); } catch { specifications = {}; }
      }
      // Map category name to ObjectId if needed
      let categoryId = category;
      if (category && typeof category === 'string' && !category.match(/^[0-9a-fA-F]{24}$/)) {
        // Try to find category by name
        const Category = (await import('../models/Category.js')).default;
        const catDoc = await Category.findOne({ name: category });
        if (catDoc) categoryId = catDoc._id;
      }

      const product = await Product.create({
        name,
        description,
        fullDescription,
        images,
        price,
        originalPrice,
        discount,
        rating,
        reviews,
        inStock,
        category: categoryId,
        ingredients,
        benefits,
        howToUse,
        specifications,
        stock,
        isActive
      });
      await product.populate('category');
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('category');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;


