# Products Store System

A complete e-commerce system for employees to purchase products (like squeegees) directly from the application.

## Features Implemented

### Employee Features
- ✅ **Product Browsing**: View all available products with images, descriptions, and prices
- ✅ **Shopping Cart**: Add items to cart, adjust quantities, view total
- ✅ **Checkout Flow**: 
  - Click "Checkout" to start order process
  - Camera prompt to take photo of items being purchased
  - Zelle QR code display with total amount
  - Order confirmation
- ✅ **Order History**: View all past orders with status tracking
- ✅ **Order Status**: See if order is pending, paid, fulfilled, or cancelled

### Admin Features
- ✅ **Product Management**: 
  - Add new products with images, descriptions, prices
  - Edit existing products
  - Activate/deactivate products
  - Delete products
- ✅ **Order Management**:
  - View all orders from all employees
  - Filter by status (pending, paid, fulfilled, cancelled)
  - Search orders by customer name, order ID, or amount
  - View order details including:
    - Customer information
    - Order items and quantities
    - Order photo (proof of items)
    - Order total
    - Order status
  - Update order status (mark as paid, fulfilled, etc.)
- ✅ **Order Notifications**: Real-time notifications when new orders are placed

## Additional Robust Features Included

1. **Order Photos**: Every order includes a photo of the items being purchased for verification
2. **Order Status Tracking**: 
   - Pending: Awaiting payment
   - Paid: Payment received
   - Fulfilled: Items given to employee
   - Cancelled: Order cancelled
3. **Order History**: Employees can see their complete order history
4. **Search & Filter**: Admins can search and filter orders for easy management
5. **Real-time Updates**: Socket.io notifications for new orders
6. **Image Upload**: Support for product images and order photos
7. **Order Details**: Complete order information including items, quantities, prices, and totals

## Setup Instructions

### 1. Run Database Migration
```bash
cd backend
node database/create_products_tables.js
```

This creates:
- `products` table
- `orders` table  
- `order_items` table
- Adds default sample products

### 2. Add Zelle QR Code
Place your Zelle QR code image in:
- `frontend/public/zelle-qr.png` (or `.jpg`)

Or configure via environment variable:
- `frontend/.env`: `VITE_ZELLE_QR_CODE=/path/to/qr-code.png`

### 3. Restart Backend Server
The new routes need to be loaded:
- `/api/products` - Product management
- `/api/orders` - Order management

### 4. Access the Store
- **Employees**: Navigate to "Products" in the sidebar
- **Admins**: Navigate to "Admin" → "Products" tab to manage products
- **Admins**: Navigate to "Admin" → "Orders" tab to manage orders

## Payment Flow

1. Employee adds items to cart
2. Clicks "Checkout"
3. Camera opens to take photo of items
4. After photo is captured, Zelle QR code is displayed
5. Employee scans QR code and sends payment
6. Employee clicks "I've Sent Payment"
7. Order is created with status "pending"
8. Admin receives notification of new order
9. Admin verifies payment and updates status to "paid"
10. Admin gives items to employee and updates status to "fulfilled"

## Future Enhancement Ideas

### Payment Verification
- **Zelle API Integration**: If Zelle offers an API, integrate for automatic payment verification
- **Bank Webhooks**: Set up webhook notifications from your bank to automatically match payments
- **Payment Matching**: Match incoming payments to orders by amount and timestamp

### Inventory Management
- Add `stock_quantity` field to products table
- Track inventory levels
- Show "Out of Stock" when quantity is 0
- Low stock alerts for admins

### Order Enhancements
- **Order Notes**: Allow employees to add notes when ordering
- **Bulk Orders**: Allow ordering multiple of the same item easily
- **Order Templates**: Save common order combinations
- **Order Reminders**: Notify employees if payment is pending for too long

### Reporting
- Sales reports by product
- Revenue tracking
- Most popular products
- Employee purchase history reports

### Notifications
- Email notifications for order status changes
- SMS notifications (optional)
- Push notifications for mobile

### Additional Features
- **Discount Codes**: Add coupon/discount code support
- **Product Categories**: Organize products by category
- **Product Reviews**: Allow employees to review products
- **Wishlist**: Save items for later purchase
- **Recurring Orders**: Set up automatic reorders for frequently purchased items

## Database Schema

### products
- `id` - Primary key
- `name` - Product name
- `description` - Product description
- `price` - Product price (decimal)
- `image_url` - Path to product image
- `is_active` - Whether product is visible to employees
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### orders
- `id` - Primary key
- `user_id` - Employee who placed order
- `total_amount` - Order total
- `status` - Order status (pending, paid, fulfilled, cancelled)
- `photo_url` - Path to order photo
- `zelle_qr_code` - Zelle QR code used
- `notes` - Order notes
- `created_at` - Order creation timestamp
- `updated_at` - Last update timestamp
- `paid_at` - Payment received timestamp
- `fulfilled_at` - Order fulfilled timestamp

### order_items
- `id` - Primary key
- `order_id` - Foreign key to orders
- `product_id` - Foreign key to products
- `quantity` - Quantity ordered
- `price` - Price at time of order (for historical accuracy)
- `created_at` - Creation timestamp

## File Structure

```
backend/
  routes/
    products.js      # Product CRUD operations
    orders.js        # Order creation and management
  database/
    create_products_tables.js  # Database migration
  uploads/
    products/        # Product images
    orders/         # Order photos

frontend/
  pages/
    Products.jsx    # Employee shopping page
  components/
    Admin/
      ProductManagement.jsx  # Admin product management
      OrderManagement.jsx    # Admin order management
  public/
    zelle-qr.png   # Your Zelle QR code (add this)
```

## API Endpoints

### Products
- `GET /api/products` - Get all products (filtered by active for employees)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/:id` - Update product (admin only)
- `DELETE /api/products/:id` - Delete product (admin only)

### Orders
- `GET /api/orders` - Get orders (user's own for employees, all for admins)
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order with photo
- `PUT /api/orders/:id/status` - Update order status (admin only)

## Notes

- **Payment Verification**: Currently manual. Admins verify payment and update status.
- **Zelle Integration**: Zelle doesn't currently offer a public API for payment verification, so manual verification is required.
- **Camera Access**: Requires browser camera permissions. Works best on mobile devices.
- **Image Storage**: Product images and order photos are stored in `backend/uploads/`

