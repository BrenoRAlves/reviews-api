const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "database.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      price REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (user_id) REFERENCES users(id),
      CHECK (status IN ('pending', 'completed', 'cancelled'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price_at_purchase REAL NOT NULL,

      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      UNIQUE(order_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER NOT NULL UNIQUE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (order_item_id) REFERENCES order_items(id),
      CHECK (status IN ('pending', 'approved', 'rejected'))
    );

    CREATE TABLE IF NOT EXISTS review_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL UNIQUE,
      sentiment TEXT NOT NULL,
      topic TEXT NOT NULL,
      urgency TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_review_summary (
      product_id INTEGER PRIMARY KEY,
      approved_rating_sum INTEGER NOT NULL DEFAULT 0,
      approved_review_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (product_id) REFERENCES products(id),

      CHECK (
        (
          approved_review_count = 0
          AND approved_rating_sum = 0
        )
        OR
        (
          approved_review_count > 0
          AND approved_rating_sum BETWEEN approved_review_count AND approved_review_count * 5
        )
      )
    );
  `);

  seedDatabase();
}

function resetDatabase() {
  db.exec(`
    DROP TABLE IF EXISTS product_review_summary;
    DROP TABLE IF EXISTS review_analysis;
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS users;
  `);

  initDatabase();
}

function seedDatabase() {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;

  if (userCount > 0) {
    console.log("Database already has seed data");
    return;
  }

  db.exec("BEGIN TRANSACTION");

  try {
    const insertUser = db.prepare(`
      INSERT INTO users (name, email)
      VALUES (?, ?)
    `);

    const insertProduct = db.prepare(`
      INSERT INTO products (name, category, price)
      VALUES (?, ?, ?)
    `);

    const insertOrder = db.prepare(`
      INSERT INTO orders (user_id, status)
      VALUES (?, ?)
    `);

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
      VALUES (?, ?, ?, ?)
    `);

    const breno = insertUser.run("Breno Alves", "breno@example.com").lastInsertRowid;
    const alice = insertUser.run("Alice Morgan", "alice@example.com").lastInsertRowid;

    const mouse = insertProduct.run("Wireless Mouse", "Electronics", 29.99).lastInsertRowid;
    const backpack = insertProduct.run("Travel Backpack", "Accessories", 59.99).lastInsertRowid;
    const headphones = insertProduct.run("Noise Cancelling Headphones", "Electronics", 129.99).lastInsertRowid;

    const completedOrderOne = insertOrder.run(breno, "completed").lastInsertRowid;
    const completedOrderTwo = insertOrder.run(breno, "completed").lastInsertRowid;
    const pendingOrder = insertOrder.run(alice, "pending").lastInsertRowid;

    insertOrderItem.run(completedOrderOne, mouse, 1, 29.99);      // orderItemId 1
    insertOrderItem.run(completedOrderOne, backpack, 1, 59.99);   // orderItemId 2
    insertOrderItem.run(completedOrderTwo, mouse, 1, 27.99);      // orderItemId 3: same user, same product, different order
    insertOrderItem.run(pendingOrder, headphones, 1, 129.99);     // orderItemId 4: cannot review because order is pending

    db.exec("COMMIT");
    console.log("Seed data created successfully");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

if (require.main === module) {
  initDatabase();
  console.log("Database initialized successfully");
}

module.exports = {
  db,
  initDatabase,
  resetDatabase
};