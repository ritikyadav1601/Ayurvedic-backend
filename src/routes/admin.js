import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(requireAuth, requireAdmin);

// Dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalCategories,
      totalOrders,
      recentOrders,
      lowStockProducts
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Category.countDocuments(),
      Order.countDocuments(),
      Order.find()
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(5),
      Product.find({ stock: { $lte: 10 } }).limit(10)
    ]);

    const revenueStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' }
        }
      }
    ]);

    const monthlyRevenue = await Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      overview: {
        totalUsers,
        totalProducts,
        totalCategories,
        totalOrders,
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        avgOrderValue: revenueStats[0]?.avgOrderValue || 0
      },
      recentOrders,
      lowStockProducts,
      monthlyRevenue
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User management
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    res.json({
      users,
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

router.put('/users/:id/role', 
  body('role').isIn(['user', 'admin']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role: req.body.role },
        { new: true }
      ).select('-passwordHash');
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Product management
router.get('/products', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name')
        .sort({ createdAt: -1 })
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

router.put('/products/:id/stock',
  body('stock').isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { stock: req.body.stock },
        { new: true }
      ).populate('category', 'name');
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.put('/products/:id/status',
  body('isActive').isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { isActive: req.body.isActive },
        { new: true }
      ).populate('category', 'name');
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Category management
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create category
router.post('/categories',
  body('name').isString().isLength({ min: 2 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const existing = await Category.findOne({ name: req.body.name.trim() });
      if (existing) {
        return res.status(400).json({ message: 'Category already exists' });
      }
      const category = await Category.create({
        name: req.body.name.trim(),
        description: req.body.description || ''
      });
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Update category
router.put('/categories/:id',
  body('name').optional().isString().isLength({ min: 2 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const payload = {};
      if (req.body.name) payload.name = req.body.name.trim();
      if (typeof req.body.description === 'string') payload.description = req.body.description;

      const category = await Category.findByIdAndUpdate(
        req.params.id,
        payload,
        { new: true }
      );
      if (!category) return res.status(404).json({ message: 'Category not found' });
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Delete category (prevent delete if products reference it)
router.delete('/categories/:id', async (req, res) => {
  try {
    const productCount = await Product.countDocuments({ category: req.params.id });
    if (productCount > 0) {
      return res.status(400).json({ message: 'Cannot delete category with linked products' });
    }
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Order management
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {};
    if (status) query.status = status;
    
    let populateQuery = [
      { path: 'user', select: 'name email' },
      { path: 'items.product', select: 'name images' }
    ];
    
    let findQuery = Order.find(query)
      .populate(populateQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    if (search) {
      findQuery = Order.find({
        ...query,
        $or: [
          { 'user.name': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } }
        ]
      })
      .populate(populateQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    }
    
    const [orders, total] = await Promise.all([
      findQuery,
      search ? Order.countDocuments({
        ...query,
        $or: [
          { 'user.name': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } }
        ]
      }) : Order.countDocuments(query)
    ]);
    
    res.json({
      orders,
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

// Create admin user
router.post('/create-admin',
  body('name').isString().isLength({ min: 2 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const { name, email, password } = req.body;
      
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);
      
      const admin = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: 'admin'
      });
      
      res.status(201).json({
        message: 'Admin user created successfully',
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

export default router;
