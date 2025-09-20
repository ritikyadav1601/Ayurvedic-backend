import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// Get user's orders (requires auth)
router.get('/my-orders', requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get specific order (requires auth)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.product', 'name images');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if user owns this order or is admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create order from cart (requires auth - checkout)
router.post('/checkout', requireAuth,
  body('items').isArray({ min: 1 }),
  body('address').isString().isLength({ min: 10 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const { items, address } = req.body;
      
      // Validate items and calculate total
      let total = 0;
      const validatedItems = [];
      
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          return res.status(400).json({ message: `Product ${item.productId} not found or unavailable` });
        }
        
        if (product.stock < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
        }
        
        validatedItems.push({
          product: product._id,
          quantity: item.quantity,
          priceAtPurchase: product.price
        });
        
        total += product.price * item.quantity;
      }
      
      // Create order
      const order = await Order.create({
        user: req.user.id,
        items: validatedItems,
        total,
        address,
        status: 'pending'
      });
      
      // Update product stock
      for (const item of validatedItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity }
        });
      }
      
      await order.populate('items.product', 'name images');
      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Admin routes
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {};
    if (status) query.status = status;
    
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email')
        .populate('items.product', 'name images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query)
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

router.put('/:id/status', requireAuth, requireAdmin,
  body('status').isIn(['pending', 'paid', 'shipped', 'completed', 'cancelled']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const order = await Order.findByIdAndUpdate(
        req.params.id, 
        { status: req.body.status }, 
        { new: true }
      ).populate('user', 'name email').populate('items.product', 'name images');
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Get order statistics (admin only)
router.get('/stats/overview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' }
        }
      }
    ]);
    
    const statusCounts = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({
      overview: stats[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 },
      statusCounts,
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;


