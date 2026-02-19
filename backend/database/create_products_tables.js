import db from './db.js';

const createProductsTables = async () => {
  try {
    // Products table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image_url TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Orders table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        total_amount DECIMAL(10,2) NOT NULL,
        status TEXT CHECK(status IN ('pending', 'paid', 'fulfilled', 'cancelled')) DEFAULT 'pending',
        photo_url TEXT,
        zelle_qr_code TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        paid_at DATETIME,
        fulfilled_at DATETIME
      )
    `);

    // Order items table (many-to-many relationship)
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Created products, orders, and order_items tables');
    
    // Insert some default products if none exist
    const existingProducts = await db.allAsync('SELECT COUNT(*) as count FROM products');
    if (existingProducts[0].count === 0) {
      await db.runAsync(`
        INSERT INTO products (name, description, price, is_active)
        VALUES 
          ('Squeegee - Standard', 'Standard squeegee for window tinting', 15.00, 1),
          ('Squeegee - Premium', 'Premium squeegee with ergonomic handle', 25.00, 1),
          ('Squeegee - Heavy Duty', 'Heavy duty squeegee for tough jobs', 35.00, 1)
      `);
      console.log('✅ Added default products');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating products tables:', error);
    process.exit(1);
  }
};

createProductsTables();

