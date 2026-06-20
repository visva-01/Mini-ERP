import { query } from "./db";
import fs from "fs";
import path from "path";

/**
 * Initializes the PostgreSQL database by creating all required tables
 * and seeding them with default and local configurations if empty.
 */
export async function initializeDatabase() {
  console.log("--------------------------------------------------");
  console.log("[DB] Checking PostgreSQL database connection...");
  try {
    // 1. Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'operator',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("[DB] 'users' table is verified/created.");

    // 2. Create products table
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sales_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
        cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
        on_hand NUMERIC(12, 2) NOT NULL DEFAULT 0,
        reserved NUMERIC(12, 2) NOT NULL DEFAULT 0,
        procure_on_demand BOOLEAN DEFAULT FALSE,
        procurement_type VARCHAR(50) DEFAULT 'purchase',
        vendor VARCHAR(255),
        bom_id VARCHAR(50)
      );
    `);
    console.log("[DB] 'products' table is verified/created.");

    // 3. Create boms table
    await query(`
      CREATE TABLE IF NOT EXISTS boms (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        product_id VARCHAR(50) NOT NULL,
        output_qty NUMERIC(12, 2) NOT NULL DEFAULT 1,
        components JSONB NOT NULL DEFAULT '[]'::jsonb,
        operations JSONB NOT NULL DEFAULT '[]'::jsonb
      );
    `);
    console.log("[DB] 'boms' table is verified/created.");

    // 4. Create sales_orders table
    await query(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id VARCHAR(50) PRIMARY KEY,
        reference VARCHAR(50) UNIQUE NOT NULL,
        customer VARCHAR(255) NOT NULL,
        date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'draft',
        lines JSONB NOT NULL DEFAULT '[]'::jsonb
      );
    `);
    console.log("[DB] 'sales_orders' table is verified/created.");

    // 5. Create purchase_orders table
    await query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id VARCHAR(50) PRIMARY KEY,
        reference VARCHAR(50) UNIQUE NOT NULL,
        vendor VARCHAR(255) NOT NULL,
        date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'draft',
        lines JSONB NOT NULL DEFAULT '[]'::jsonb
      );
    `);
    console.log("[DB] 'purchase_orders' table is verified/created.");

    // 6. Create manufacturing_orders table
    await query(`
      CREATE TABLE IF NOT EXISTS manufacturing_orders (
        id VARCHAR(50) PRIMARY KEY,
        reference VARCHAR(50) UNIQUE NOT NULL,
        product_id VARCHAR(50) NOT NULL,
        quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
        bom_id VARCHAR(50),
        assignee VARCHAR(255),
        date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'draft',
        work_orders JSONB NOT NULL DEFAULT '[]'::jsonb,
        consumed_components JSONB NOT NULL DEFAULT '[]'::jsonb
      );
    `);
    console.log("[DB] 'manufacturing_orders' table is verified/created.");

    // 7. Create stock_moves table
    await query(`
      CREATE TABLE IF NOT EXISTS stock_moves (
        id VARCHAR(50) PRIMARY KEY,
        date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        product_id VARCHAR(50) NOT NULL,
        quantity NUMERIC(12, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        ref VARCHAR(50)
      );
    `);
    console.log("[DB] 'stock_moves' table is verified/created.");

    // 8. Create audit_log table
    await query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR(50) PRIMARY KEY,
        date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        module VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        ref VARCHAR(255),
        detail TEXT
      );
    `);
    console.log("[DB] 'audit_log' table is verified/created.");

    // Seed users if empty
    const userRes = await query("SELECT COUNT(*) FROM users;");
    const userCount = parseInt(userRes.rows[0].count, 10);

    if (userCount === 0) {
      console.log("[DB] Seeding users from local database configuration...");
      const localDbPath = path.join(process.cwd(), "src/lib/local-db.json");
      let usersToSeed = [
        { username: "admin", password_hash: "admin123", role: "admin" },
        { username: "operator", password_hash: "operator123", role: "operator" }
      ];

      if (fs.existsSync(localDbPath)) {
        try {
          const fileData = fs.readFileSync(localDbPath, "utf-8");
          const parsed = JSON.parse(fileData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            usersToSeed = parsed;
            console.log(`[DB] Found ${parsed.length} local users in local-db.json to import.`);
          }
        } catch (e) {
          console.error("[DB] Could not parse local-db.json, falling back to default seeding:", e);
        }
      }

      for (const u of usersToSeed) {
        await query(
          "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING;",
          [u.username, u.password_hash, u.role]
        );
      }
      console.log("[DB] User seeding complete.");
    }

    // Seed products & default ERP transactional data if products is empty
    const prodRes = await query("SELECT COUNT(*) FROM products;");
    const prodCount = parseInt(prodRes.rows[0].count, 10);
    if (prodCount === 0) {
      console.log("[DB] Seeding default ERP transactional data...");
      await seedDatabaseDemo();
    } else {
      console.log(`[DB] Database is already initialized with ${prodCount} products.`);
    }

  } catch (error: any) {
    console.error("\x1b[31m%s\x1b[0m", "[DB ERROR] PostgreSQL initialization failed!");
    console.error("  Details:", error.message);
    console.error("  Check if your PostgreSQL server is running and the database matches your .env config.");
  }
  console.log("--------------------------------------------------");
}

/**
 * Seeds the default demo data into PostgreSQL tables
 */
async function seedDatabaseDemo() {
  try {
    // 1. Insert products
    await query(`
      INSERT INTO products (id, name, sales_price, cost_price, on_hand, reserved, procure_on_demand, procurement_type, vendor, bom_id) VALUES
      ('prod_legs', 'Wooden Legs', 80, 50, 200, 0, true, 'purchase', 'TimberCo', null),
      ('prod_top', 'Wooden Top', 600, 400, 30, 0, true, 'purchase', 'TimberCo', null),
      ('prod_screws', 'Screws (pack)', 5, 2, 1000, 0, true, 'purchase', 'FastenerHub', null),
      ('prod_table', 'Dining Table', 4500, 2200, 5, 0, true, 'manufacturing', null, 'bom_table'),
      ('prod_chair', 'Office Chair', 2200, 1100, 12, 0, false, 'manufacturing', null, null)
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Insert BOM
    await query(`
      INSERT INTO boms (id, name, product_id, output_qty, components, operations) VALUES
      ('bom_table', 'Dining Table BoM', 'prod_table', 1,
       '[{"productId": "prod_legs", "quantity": 4}, {"productId": "prod_top", "quantity": 1}, {"productId": "prod_screws", "quantity": 12}]'::jsonb,
       '[{"name": "Assembly", "workCenter": "Assembly Line", "durationMin": 60}, {"name": "Painting", "workCenter": "Paint Floor", "durationMin": 30}, {"name": "Packing", "workCenter": "Packaging Unit", "durationMin": 20}]'::jsonb
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    // 3. Insert Stock Moves
    await query(`
      INSERT INTO stock_moves (id, date, product_id, quantity, reason, ref) VALUES
      ('move_legs', NOW() - INTERVAL '4 hours', 'prod_legs', 200, 'Initial purchase', 'PO-0001'),
      ('move_top', NOW() - INTERVAL '3 hours', 'prod_top', 30, 'Initial purchase', 'PO-0002'),
      ('move_screws', NOW() - INTERVAL '2 hours', 'prod_screws', 1000, 'Initial purchase', 'PO-0003'),
      ('move_table', NOW() - INTERVAL '1 hour', 'prod_table', -2, 'Sales delivery', 'SO-0001')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. Insert Audits
    await query(`
      INSERT INTO audit_log (id, date, module, action, ref, detail) VALUES
      ('audit_seed_sys', NOW(), 'System', 'Demo data seeded', null, null),
      ('audit_seed_stock', NOW(), 'Stock', 'Inventory initialized', 'Seeded', null)
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("[DB] Seeding ERP demo data complete.");
  } catch (error: any) {
    console.error("[DB] Failed to seed default demo data:", error.message);
  }
}
