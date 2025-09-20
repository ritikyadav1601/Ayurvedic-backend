import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// Public routes - no auth required
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id/products', async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, total] = await Promise.all([
      Product.find({ category: req.params.id, isActive: true })
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments({ category: req.params.id, isActive: true })
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

// Admin routes - require auth
router.post('/', requireAuth, requireAdmin,
  body('name').isString().isLength({ min: 2 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const { name, description } = req.body;
      const exists = await Category.findOne({ name });
      if (exists) return res.status(400).json({ message: 'Category already exists' });
      
      const category = await Category.create({ name, description });
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.put('/:id', requireAuth, requireAdmin,
  body('name').optional().isString().isLength({ min: 2 }),
  async (req, res) => {
    try {
      const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!category) return res.status(404).json({ message: 'Category not found' });
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Check if category has products
    const productCount = await Product.countDocuments({ category: req.params.id });
    if (productCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. It has ${productCount} products. Please move or delete products first.` 
      });
    }
    
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;


