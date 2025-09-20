# Ayurvedic E-commerce Backend API

A complete Node.js/Express backend for an Ayurvedic e-commerce website with MongoDB database.

## Features

- **Public Product Browsing**: No authentication required for viewing products, categories
- **Session-based Cart**: Add/remove items without login
- **User Authentication**: JWT-based auth for checkout and account management
- **Admin Panel**: Complete admin functionality for managing products, orders, users
- **Order Management**: Full order lifecycle with status tracking
- **Search & Filtering**: Advanced product search and filtering capabilities

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and JWT secret
   ```

3. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

4. **Run the Server**
   ```bash
   npm run dev
   ```

5. **Create First Admin User**
   ```bash
   curl -X POST http://localhost:4000/api/admin/create-admin \
     -H "Content-Type: application/json" \
     -d '{"name":"Admin","email":"admin@example.com","password":"password123"}'
   ```

## API Endpoints

### Public Routes (No Auth Required)

#### Products
- `GET /api/products` - List products with filtering, search, pagination
- `GET /api/products/featured` - Get featured products
- `GET /api/products/:id` - Get single product details

#### Categories
- `GET /api/categories` - List all categories
- `GET /api/categories/:id` - Get category details
- `GET /api/categories/:id/products` - Get products in category

#### Cart (Session-based)
- `GET /api/cart` - Get cart contents
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update` - Update item quantity
- `DELETE /api/cart/remove/:productId` - Remove item from cart
- `DELETE /api/cart/clear` - Clear entire cart

### Authentication Required

#### Auth
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

#### Orders
- `GET /api/orders/my-orders` - Get user's orders
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/checkout` - Create order from cart

### Admin Routes (Admin Role Required)

#### Admin Dashboard
- `GET /api/admin/dashboard` - Dashboard statistics
- `POST /api/admin/create-admin` - Create admin user

#### User Management
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id/role` - Update user role

#### Product Management
- `GET /api/admin/products` - List products (admin view)
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `PUT /api/admin/products/:id/stock` - Update stock
- `PUT /api/admin/products/:id/status` - Toggle active status

#### Category Management
- `GET /api/admin/categories` - List categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

#### Order Management
- `GET /api/admin/orders` - List all orders
- `PUT /api/orders/:id/status` - Update order status
- `GET /api/orders/stats/overview` - Order statistics

## Query Parameters

### Products
- `category` - Filter by category ID
- `search` - Search in name/description
- `minPrice` / `maxPrice` - Price range filter
- `sort` - Sort by: `newest`, `price-low`, `price-high`, `name`
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 12)

### Cart
- `X-Session-ID` header - Session identifier for cart

## Authentication

Include JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Data Models

### Product
```javascript
{
  name: String,
  description: String,
  images: [String],
  price: Number,
  stock: Number,
  category: ObjectId,
  isActive: Boolean
}
```

### Category
```javascript
{
  name: String,
  description: String
}
```

### Order
```javascript
{
  user: ObjectId,
  items: [{
    product: ObjectId,
    quantity: Number,
    priceAtPurchase: Number
  }],
  total: Number,
  status: String, // pending, paid, shipped, completed, cancelled
  address: String
}
```

### User
```javascript
{
  name: String,
  email: String,
  passwordHash: String,
  role: String // user, admin
}
```

## Environment Variables

```env
MONGO_URI=mongodb://localhost:27017/ayurvedic_ecommerce
JWT_SECRET=your-super-secret-jwt-key
PORT=4000
```

## Production Notes

- Use Redis for cart storage instead of in-memory
- Implement proper error logging
- Add rate limiting
- Use HTTPS
- Set up proper CORS configuration
- Implement file upload for product images
- Add email notifications for orders
- Set up payment integration

## Testing

Test the API with curl or Postman:

```bash
# Health check
curl http://localhost:4000/api/health

# Get products
curl http://localhost:4000/api/products

# Register user
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```
