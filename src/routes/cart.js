import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Product from '../models/Product.js';

const router = Router();

// In-memory cart storage (in production, use Redis or database)
const carts = new Map();

// Helper function to get cart
const getCart = (sessionId) => {
  if (!carts.has(sessionId)) {
    carts.set(sessionId, { items: [], total: 0 });
  }
  return carts.get(sessionId);
};

// Helper function to calculate cart total
const calculateTotal = (items) => {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};

// Get cart contents
router.get('/', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'default';
    const cart = getCart(sessionId);
    
    // Populate product details
    const populatedItems = await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.findById(item.productId).select('name price images');
        return {
          ...item,
          product: product || null
        };
      })
    );
    
    res.json({
      items: populatedItems.filter(item => item.product), // Remove items with deleted products
      total: calculateTotal(cart.items)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add item to cart
router.post('/add', 
  body('productId').isMongoId(),
  body('quantity').isInt({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const { productId, quantity } = req.body;
      const sessionId = req.headers['x-session-id'] || 'default';
      
      // Check if product exists and is active
      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res.status(404).json({ message: 'Product not found or unavailable' });
      }
      
      // Check stock availability
      if (product.stock < quantity) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }
      
      const cart = getCart(sessionId);
      
      // Check if item already exists in cart
      const existingItemIndex = cart.items.findIndex(item => item.productId === productId);
      
      if (existingItemIndex > -1) {
        // Update quantity
        cart.items[existingItemIndex].quantity += quantity;
      } else {
        // Add new item
        cart.items.push({
          productId,
          quantity,
          price: product.price
        });
      }
      
      cart.total = calculateTotal(cart.items);
      carts.set(sessionId, cart);
      
      res.json({ message: 'Item added to cart', cart });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Update item quantity in cart
router.put('/update',
  body('productId').isMongoId(),
  body('quantity').isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const { productId, quantity } = req.body;
      const sessionId = req.headers['x-session-id'] || 'default';
      const cart = getCart(sessionId);
      
      const itemIndex = cart.items.findIndex(item => item.productId === productId);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: 'Item not found in cart' });
      }
      
      if (quantity === 0) {
        // Remove item
        cart.items.splice(itemIndex, 1);
      } else {
        // Check stock availability
        const product = await Product.findById(productId);
        if (!product || product.stock < quantity) {
          return res.status(400).json({ message: 'Insufficient stock' });
        }
        
        // Update quantity
        cart.items[itemIndex].quantity = quantity;
      }
      
      cart.total = calculateTotal(cart.items);
      carts.set(sessionId, cart);
      
      res.json({ message: 'Cart updated', cart });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Remove item from cart
router.delete('/remove/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const sessionId = req.headers['x-session-id'] || 'default';
    const cart = getCart(sessionId);
    
    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }
    
    cart.items.splice(itemIndex, 1);
    cart.total = calculateTotal(cart.items);
    carts.set(sessionId, cart);
    
    res.json({ message: 'Item removed from cart', cart });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clear entire cart
router.delete('/clear', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'default';
    carts.set(sessionId, { items: [], total: 0 });
    
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
