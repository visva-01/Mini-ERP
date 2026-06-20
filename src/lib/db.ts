import pg from "pg";
import fs from "fs";
import path from "path";

// Ensure database connection is only instantiated on the server side
const isServer = typeof window === "undefined";
const fallbackFile = isServer ? path.join(process.cwd(), "src/lib/local-db.json") : "";

interface LocalUser {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
}

let pool: pg.Pool | null = null;

let fallbackMode = false;
let connectionString = "";

if (isServer) {
  // 1. Try to load from workspace .env file first (takes precedence)
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const match = envContent.split("\n").find((line) => line.trim().startsWith("DATABASE_URL="));
      if (match) {
        connectionString = match.split("=")[1].trim();
      }
    }
  } catch (e) {
    console.error("[DB] Failed to read .env file:", e);
  }

  // 2. Fall back to process.env if workspace .env doesn't specify it
  if (!connectionString) {
    connectionString = process.env.DATABASE_URL || "";
  }

  // 3. Final default fallback
  if (!connectionString) {
    connectionString = "postgresql://postgres:postgres@localhost:5432/flow_orchestrator";
  }

  // Mask password for safe logging
  const maskedString = connectionString.replace(/:([^:@]+)@/, ":******@");
  console.log(`[DB] Connecting to PostgreSQL using string: ${maskedString}`);

  pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 3000, // Fail fast if PostgreSQL is not running
  });

  pool.on("error", (err) => {
    console.error("Unexpected database pool error:", err);
  });
}


/**
 * Reads local users data from the JSON fallback database.
 */
function readLocalDb(): LocalUser[] {
  if (!fs.existsSync(fallbackFile)) {
    try {
      fs.writeFileSync(fallbackFile, JSON.stringify([], null, 2));
    } catch (e) {
      console.error("[DB Fallback] Failed to create database file:", e);
    }
    return [];
  }
  try {
    const data = fs.readFileSync(fallbackFile, "utf-8");
    return JSON.parse(data || "[]");
  } catch (e) {
    console.error("[DB Fallback] Error reading fallback file:", e);
    return [];
  }
}

/**
 * Writes local users data to the JSON fallback database.
 */
function writeLocalDb(users: LocalUser[]) {
  try {
    fs.writeFileSync(fallbackFile, JSON.stringify(users, null, 2));
  } catch (e) {
    console.error("[DB Fallback] Error writing fallback file:", e);
  }
}

/**
 * Emulates key SQL queries on users table using the JSON file.
 */
function runFallbackQuery(text: string, params: any[]): { rows: any[]; rowCount: number } {
  const cleanSql = text.replace(/\s+/g, " ").trim();
  const users = readLocalDb();

  // CREATE TABLE IF NOT EXISTS
  if (cleanSql.toUpperCase().startsWith("CREATE TABLE")) {
    return { rows: [], rowCount: 0 };
  }

  // SELECT COUNT(*) FROM users
  if (cleanSql.includes("COUNT(*)")) {
    return { rows: [{ count: users.length.toString() }], rowCount: 1 };
  }

  // INSERT INTO users (username, password_hash, role) ...
  if (cleanSql.toUpperCase().startsWith("INSERT INTO USERS")) {
    const [username, password_hash, role = "operator"] = params;
    const newId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const newUser: LocalUser = {
      id: newId,
      username,
      password_hash,
      role,
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    writeLocalDb(users);
    return {
      rows: [{ id: newUser.id, username: newUser.username, role: newUser.role }],
      rowCount: 1,
    };
  }

  // SELECT ... FROM users WHERE username = $1
  if (cleanSql.includes("FROM users WHERE username =")) {
    const username = params[0];
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [user], rowCount: 1 };
  }

  throw new Error(`Fallback DB engine query not supported: ${text}`);
}

export async function query(text: string, params: any[] = []) {
  if (!isServer) {
    throw new Error("Database query is only available on the server side.");
  }

  if (fallbackMode) {
    return runFallbackQuery(text, params);
  }

  try {
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    return await pool.query(text, params);
  } catch (error: any) {
    const isConnectionRefused =
      error.code === "ECONNREFUSED" ||
      error.code === "28P01" || // Password authentication failed
      error.message.includes("connect ECONNREFUSED") ||
      error.message.includes("timeout") ||
      error.message.includes("password authentication failed") ||
      error.message.includes("could not connect");

    if (isConnectionRefused) {
      if (!fallbackMode) {
        console.warn("\x1b[33m%s\x1b[0m", "[DB WARNING] PostgreSQL connection failed or credentials invalid!");
        console.warn("\x1b[33m%s\x1b[0m", `  Details: ${error.message}`);
        console.warn("\x1b[33m%s\x1b[0m", `[DB WARNING] Activating local file fallback at: ${fallbackFile}`);
        console.warn("\x1b[33m%s\x1b[0m", "[DB WARNING] Authentication functions will run in local file-based mode.");
        fallbackMode = true;
      }
      return runFallbackQuery(text, params);
    }
    throw error;
  }
}

export function getPool() {
  return pool;
}
