import Database from "@tauri-apps/plugin-sql";
import { resolveResource, dirname, join } from "@tauri-apps/api/path";
import { exists, mkdir, copyFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { formatThickness, formatWidth } from "./utils.js";
import { hashCode } from "./auth.js";

let db = null;
let currentAccessCode = null;

// Store the access code for database encryption/decryption
export function setDatabaseAccessCode(accessCode) {
  currentAccessCode = accessCode;
}

// Clear the access code from memory
export function clearDatabaseAccessCode() {
  currentAccessCode = null;
}

// Simple encryption/decryption using the access code
async function encryptData(data, accessCode) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Create a key from the access code
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(accessCode.padEnd(32, "0")), // Pad to 32 bytes
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(data)
  );

  // Combine salt, iv, and encrypted data
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);

  return Array.from(result);
}

async function decryptData(encryptedArray, accessCode) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const encryptedData = new Uint8Array(encryptedArray);
  const salt = encryptedData.slice(0, 16);
  const iv = encryptedData.slice(16, 28);
  const encrypted = encryptedData.slice(28);

  // Create a key from the access code
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(accessCode.padEnd(32, "0")), // Pad to 32 bytes
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encrypted
  );

  return decoder.decode(decrypted);
}

export async function initializeDatabase(accessCode = null) {
  try {
    console.log("Initializing PORTABLE database...");

    // Store the access code for later use
    if (accessCode) {
      setDatabaseAccessCode(accessCode);
    }

    // For a truly portable app, we need to get the executable's directory
    // and create the database there, not in AppData
    let portableDbPath = null;

    try {
      // Get the current executable path
      const currentExe = await invoke("get_current_exe_path");
      console.log(`Executable path: ${currentExe}`);

      // Get the directory containing the executable
      const exeDir = await dirname(currentExe);
      console.log(`Executable directory: ${exeDir}`);

      // Create portable database path (next to executable)
      portableDbPath = await join(exeDir, "data", "steel_track.db");
      const portableDataDir = await join(exeDir, "data");

      console.log(`Portable database path: ${portableDbPath}`);
      console.log(`Portable data directory: ${portableDataDir}`);

      // Create data directory if it doesn't exist
      if (!(await exists(portableDataDir))) {
        console.log("Creating portable data directory...");
        await mkdir(portableDataDir, { recursive: true });
      }

      // Check if portable database exists
      if (await exists(portableDbPath)) {
        console.log("Found existing portable database, loading...");
        db = await Database.load(`sqlite:${portableDbPath}`);
        console.log("Portable database loaded successfully!");
      } else {
        console.log("Portable database not found, checking for template...");

        // Try to copy from bundled resources if available
        try {
          const resourcePath = await resolveResource("steel_track.db");
          console.log(`Checking for bundled database: ${resourcePath}`);

          if (await exists(resourcePath)) {
            console.log(
              "Found bundled database, copying to portable location..."
            );
            await copyFile(resourcePath, portableDbPath);
            console.log("Database copied successfully!");
          }
        } catch (resourceError) {
          console.log("No bundled database found, will create new one");
        }

        // Load or create the portable database
        console.log(`Creating/loading portable database: ${portableDbPath}`);
        db = await Database.load(`sqlite:${portableDbPath}`);
        console.log("Portable database created/loaded successfully!");
      }
    } catch (exeError) {
      console.error("Failed to get executable path:", exeError);
      console.log("Falling back to relative paths...");

      // Fallback: try direct relative paths
      const fallbackPaths = [
        "sqlite:steel_track.db", // Same directory as executable
        "sqlite:data/steel_track.db", // Local data subfolder
        "sqlite:./data/steel_track.db", // Current directory data subfolder
      ];

      for (const dbPath of fallbackPaths) {
        try {
          console.log(`Attempting fallback path: ${dbPath}`);
          db = await Database.load(dbPath);
          console.log(`Database loaded from fallback path: ${dbPath}`);
          break;
        } catch (pathError) {
          console.log(
            `Failed fallback path ${dbPath}:`,
            pathError.message || pathError
          );
          continue;
        }
      }
    }

    if (!db) {
      throw new Error("Unable to create portable database - check permissions");
    }

    // Create tables if they don't exist
    await createTables();
    console.log("Portable database initialized successfully!");
    console.log(
      "✅ Your database is now portable - it will travel with your app!"
    );
    return db;
  } catch (error) {
    console.error("Error initializing portable database:", error);
    throw error;
  }
}

async function createTables() {
  try {
    // Create auth_codes table for storing hashed access codes
    await db.execute(`
      CREATE TABLE IF NOT EXISTS auth_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_hash TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create inventory table for storing stock details (without thickness and width)
    // Note: CHECK constraints removed to support encrypted data
    await db.execute(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_date DATE NOT NULL,
        sno TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL NOT NULL,
        lot TEXT NOT NULL,
        quality TEXT NOT NULL,
        sold_to TEXT,
        completed BOOLEAN DEFAULT 0,
        dc_status BOOLEAN DEFAULT 0,
        coating TEXT,
        specifications TEXT,
        form TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `); // Create dimensions table for storing multiple thickness/width combinations per inventory item
    await db.execute(`
      CREATE TABLE IF NOT EXISTS inventory_dimensions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_id INTEGER NOT NULL,
        thickness REAL NOT NULL,
        width INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
      )
    `);

    // Create sales table for tracking sales transactions
    // Note: CHECK constraints removed to support encrypted data
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_id INTEGER NOT NULL,
        sold_to TEXT NOT NULL,
        quantity_sold REAL NOT NULL,
        form TEXT NOT NULL,
        sale_date DATE NOT NULL,
        dimensions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
      )
    `); // Add dimensions column to existing sales table if it doesn't exist
    try {
      await db.execute(`ALTER TABLE sales ADD COLUMN dimensions TEXT`);
    } catch (error) {
      // Column already exists or other error - this is fine for existing databases
      console.log(
        "Dimensions column already exists in sales table or other error:",
        error.message
      );
    }

    // Add new columns to existing inventory table if they don't exist
    try {
      await db.execute(`ALTER TABLE inventory ADD COLUMN coating TEXT`);
    } catch (error) {
      console.log(
        "Coating column already exists or other error:",
        error.message
      );
    }

    try {
      await db.execute(`ALTER TABLE inventory ADD COLUMN specifications TEXT`);
    } catch (error) {
      console.log(
        "Specifications column already exists or other error:",
        error.message
      );
    }

    try {
      await db.execute(`ALTER TABLE inventory ADD COLUMN form TEXT`);
    } catch (error) {
      console.log("Form column already exists or other error:", error.message);
    }

    // Migrate data from grade to coating if grade exists and coating is empty
    try {
      await db.execute(
        `UPDATE inventory SET coating = grade WHERE coating IS NULL AND grade IS NOT NULL`
      );
    } catch (error) {
      console.log("Could not migrate grade to coating:", error.message);
    }

    // Check if we need to migrate existing tables that have CHECK constraints
    await migrateTableConstraints();
    console.log("Tables created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
}

// Function to migrate existing tables that may have CHECK constraints
async function migrateTableConstraints() {
  try {
    console.log(
      "Checking for tables with CHECK constraints that need migration..."
    );

    // Check if inventory table has CHECK constraints by trying to get table info
    const tableInfo = await db.select(`PRAGMA table_info(inventory)`);

    if (tableInfo.length > 0) {
      // Check if we can detect CHECK constraints by examining the SQL
      const sqlInfo = await db.select(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory'`
      );

      if (sqlInfo.length > 0 && sqlInfo[0].sql.includes("CHECK")) {
        console.log(
          "Found inventory table with CHECK constraints, migrating..."
        );
        await migrateInventoryTable();
      }
    }
    // Check sales table as well
    const salesTableInfo = await db.select(`PRAGMA table_info(sales)`);

    if (salesTableInfo.length > 0) {
      const salesSqlInfo = await db.select(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='sales'`
      );

      if (salesSqlInfo.length > 0 && salesSqlInfo[0].sql.includes("CHECK")) {
        console.log("Found sales table with CHECK constraints, migrating...");
        await migrateSalesTable();
      }
    }

    // Check if we need to migrate inventory_dimensions table to change width from REAL to INTEGER
    await migrateDimensionsTable();
  } catch (error) {
    console.log(
      "Note: Could not check for CHECK constraints, but this is okay for new databases"
    );
    // This is fine - might be a new database without existing constraints
  }
}

// Function to migrate inventory table by recreating it without CHECK constraints
async function migrateInventoryTable() {
  try {
    // Start a transaction for safety
    await db.execute("BEGIN TRANSACTION");
    // Create temporary table with new structure (no CHECK constraints)
    await db.execute(`
      CREATE TABLE inventory_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_date DATE NOT NULL,
        sno TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL NOT NULL,
        lot TEXT NOT NULL,
        quality TEXT NOT NULL,
        sold_to TEXT,
        completed BOOLEAN DEFAULT 0,
        dc_status BOOLEAN DEFAULT 0,
        coating TEXT,
        specifications TEXT,
        form TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Copy data from old table to new table, mapping grade to coating
    await db.execute(`
      INSERT INTO inventory_new (id, entry_date, sno, type, weight, lot, quality, sold_to, completed, dc_status, coating, specifications, form, created_at, updated_at)
      SELECT id, entry_date, sno, type, weight, lot, quality, sold_to, completed, dc_status, 
             COALESCE(grade, '') as coating, 
             '' as specifications, 
             '' as form, 
             created_at, updated_at 
      FROM inventory
    `);

    // Drop the old table
    await db.execute("DROP TABLE inventory");

    // Rename the new table
    await db.execute("ALTER TABLE inventory_new RENAME TO inventory");

    // Commit the transaction
    await db.execute("COMMIT");

    console.log(
      "✅ Inventory table migrated successfully - CHECK constraints removed"
    );
  } catch (error) {
    // Rollback on error
    await db.execute("ROLLBACK");
    console.error("Error migrating inventory table:", error);
    throw error;
  }
}

// Function to migrate sales table by recreating it without CHECK constraints
async function migrateSalesTable() {
  try {
    // Start a transaction for safety
    await db.execute("BEGIN TRANSACTION");

    // Create temporary table with new structure (no CHECK constraints)
    await db.execute(`
      CREATE TABLE sales_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_id INTEGER NOT NULL,
        sold_to TEXT NOT NULL,
        quantity_sold REAL NOT NULL,
        form TEXT NOT NULL,
        sale_date DATE NOT NULL,
        dimensions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
      )
    `);

    // Copy data from old table to new table
    await db.execute(`
      INSERT INTO sales_new 
      SELECT * FROM sales
    `);

    // Drop the old table
    await db.execute("DROP TABLE sales");

    // Rename the new table
    await db.execute("ALTER TABLE sales_new RENAME TO sales");

    // Commit the transaction
    await db.execute("COMMIT");

    console.log(
      "✅ Sales table migrated successfully - CHECK constraints removed"
    );
  } catch (error) {
    // Rollback on error
    await db.execute("ROLLBACK");
    console.error("Error migrating sales table:", error);
    throw error;
  }
}

// Function to migrate inventory_dimensions table to change width from REAL to INTEGER
async function migrateDimensionsTable() {
  try {
    console.log(
      "Checking if inventory_dimensions table needs width column migration..."
    );

    // Check if inventory_dimensions table exists
    const dimensionsTableInfo = await db.select(
      `PRAGMA table_info(inventory_dimensions)`
    );

    if (dimensionsTableInfo.length > 0) {
      // Check if width column is currently REAL by examining the SQL
      const sqlInfo = await db.select(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory_dimensions'`
      );

      if (sqlInfo.length > 0 && sqlInfo[0].sql.includes("width REAL")) {
        console.log(
          "Found inventory_dimensions table with width as REAL, migrating to INTEGER..."
        );

        // Start a transaction for safety
        await db.execute("BEGIN TRANSACTION");

        // Create temporary table with new structure (width as INTEGER)
        await db.execute(`
          CREATE TABLE inventory_dimensions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inventory_id INTEGER NOT NULL,
            thickness REAL NOT NULL,
            width INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
          )
        `);

        // Copy data from old table to new table, converting width to INTEGER
        await db.execute(`
          INSERT INTO inventory_dimensions_new (id, inventory_id, thickness, width, created_at)
          SELECT id, inventory_id, thickness, CAST(ROUND(width) AS INTEGER) as width, created_at 
          FROM inventory_dimensions
        `);

        // Drop the old table
        await db.execute("DROP TABLE inventory_dimensions");

        // Rename the new table
        await db.execute(
          "ALTER TABLE inventory_dimensions_new RENAME TO inventory_dimensions"
        );

        // Commit the transaction
        await db.execute("COMMIT");

        console.log(
          "✅ inventory_dimensions table migrated successfully - width changed from REAL to INTEGER"
        );
      } else {
        console.log(
          "inventory_dimensions table already has correct width column type"
        );
      }
    }
  } catch (error) {
    // Rollback on error
    try {
      await db.execute("ROLLBACK");
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    console.error("Error migrating inventory_dimensions table:", error);
    // Don't throw the error to avoid breaking the app for existing users
    console.log("Continuing with existing database structure...");
  }
}

// Enhanced encryption functions for database security
async function encryptSensitiveData(data, accessCode) {
  if (!data || !accessCode) return data;

  try {
    const encoder = new TextEncoder();

    // Create a key from the access code
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(accessCode.padEnd(32, "0")), // Pad to 32 bytes
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoder.encode(JSON.stringify(data))
    );

    // Combine salt, iv, and encrypted data
    const result = new Uint8Array(
      salt.length + iv.length + encrypted.byteLength
    );
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Return as base64 string for database storage
    return btoa(String.fromCharCode.apply(null, result));
  } catch (error) {
    console.error("Error encrypting data:", error);
    return data; // Return original data if encryption fails
  }
}

// Helper function to check if data appears to be encrypted
function isDataEncrypted(data) {
  if (!data || typeof data !== "string") {
    return false;
  }

  // Check if the data looks like base64 encoded data
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(data) && data.length > 50;
}

async function decryptSensitiveData(encryptedData, accessCode) {
  if (!encryptedData || !accessCode || typeof encryptedData !== "string") {
    return encryptedData;
  }

  // Check if the data looks like encrypted data using the helper function
  if (!isDataEncrypted(encryptedData)) {
    // Data doesn't look encrypted, return as-is
    return encryptedData;
  }

  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Convert from base64
    const encryptedArray = new Uint8Array(
      atob(encryptedData)
        .split("")
        .map((char) => char.charCodeAt(0))
    );

    // Validate minimum length for encrypted data (salt + iv + encrypted content)
    if (encryptedArray.length < 28) {
      // Data is too short to be properly encrypted, return as-is
      return encryptedData;
    }

    const salt = encryptedArray.slice(0, 16);
    const iv = encryptedArray.slice(16, 28);
    const encrypted = encryptedArray.slice(28);

    // Create a key from the access code
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(accessCode.padEnd(32, "0")), // Pad to 32 bytes
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encrypted
    );

    const decryptedString = decoder.decode(decrypted);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error("Error decrypting data:", error);
    return encryptedData; // Return original data if decryption fails
  }
}

// Function to check database encryption status and provide diagnostics
export async function checkDatabaseEncryptionStatus() {
  try {
    const database = await getDatabase();

    // Get a sample of inventory items to check encryption status
    const sampleItems = await database.select(
      "SELECT * FROM inventory LIMIT 5"
    );
    const sampleSales = await database.select("SELECT * FROM sales LIMIT 5");

    const status = {
      hasEncryptedInventory: false,
      hasUnencryptedInventory: false,
      hasEncryptedSales: false,
      hasUnencryptedSales: false,
      totalInventoryItems: 0,
      totalSalesRecords: 0,
    };

    // Count total records
    const inventoryCount = await database.select(
      "SELECT COUNT(*) as count FROM inventory"
    );
    const salesCount = await database.select(
      "SELECT COUNT(*) as count FROM sales"
    );
    status.totalInventoryItems = inventoryCount[0]?.count || 0;
    status.totalSalesRecords = salesCount[0]?.count || 0;
    // Check inventory encryption status
    for (const item of sampleItems) {
      const sensitiveFields = [
        "sno",
        "type",
        "weight",
        "lot",
        "sold_to",
        "coating",
        "specifications",
        "form",
      ];
      for (const field of sensitiveFields) {
        if (item[field]) {
          if (isDataEncrypted(item[field])) {
            status.hasEncryptedInventory = true;
          } else {
            status.hasUnencryptedInventory = true;
          }
        }
      }
    }

    // Check sales encryption status
    for (const sale of sampleSales) {
      const sensitiveFields = ["sold_to", "quantity_sold", "dimensions"];
      for (const field of sensitiveFields) {
        if (sale[field]) {
          if (isDataEncrypted(sale[field])) {
            status.hasEncryptedSales = true;
          } else {
            status.hasUnencryptedSales = true;
          }
        }
      }
    }

    return status;
  } catch (error) {
    console.error("Error checking database encryption status:", error);
    return null;
  }
}

// Function to setup encrypted database with initial access code
export async function setupEncryptedDatabase(accessCode) {
  try {
    console.log("Setting up encrypted database...");

    // Store the access code for encryption
    setDatabaseAccessCode(accessCode);
    // Initialize database with the access code
    await initializeDatabase(accessCode);

    // Hash and store the access code
    const hashedCode = await hashCode(accessCode);
    await storeHashedCode(hashedCode);

    console.log("✅ Encrypted database setup completed successfully!");
    console.log(
      "🔒 Your database is now encrypted and secured with your access code."
    );

    return { success: true };
  } catch (error) {
    console.error("Error setting up encrypted database:", error);
    clearDatabaseAccessCode();
    throw error;
  }
}

// Function to verify database encryption status
export async function isDatabaseEncrypted() {
  try {
    if (!currentAccessCode) {
      return false;
    }

    // Try to read and decrypt a sample record
    const database = await getDatabase();
    const sampleRecord = await database.select(
      "SELECT * FROM inventory LIMIT 1"
    );

    if (sampleRecord.length > 0) {
      // Check if data appears to be encrypted (base64 strings)
      const item = sampleRecord[0];
      const sensitiveFields = [
        "sno",
        "weight",
        "lot",
        "sold_to",
        "coating",
        "specifications",
        "form",
      ];

      for (const field of sensitiveFields) {
        if (item[field] && typeof item[field] === "string") {
          // Check if it looks like base64 encrypted data
          try {
            atob(item[field]);
            return true; // Found encrypted data
          } catch (e) {
            // Not base64, might be unencrypted
            continue;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking database encryption status:", error);
    return false;
  }
}

// Function to migrate existing unencrypted database to encrypted format
export async function migrateToEncryptedDatabase(accessCode) {
  try {
    console.log("Starting database encryption migration...");

    setDatabaseAccessCode(accessCode);
    const database = await getDatabase();

    // Get all inventory items
    const inventoryItems = await database.select("SELECT * FROM inventory");

    console.log(`Encrypting ${inventoryItems.length} inventory items...`);

    // Encrypt each inventory item
    for (const item of inventoryItems) {
      const encryptedItem = await encryptInventoryData(item);
      // Update only the sensitive fields
      const sensitiveFields = [
        "sno",
        "type",
        "weight",
        "lot",
        "sold_to",
        "coating",
        "specifications",
        "form",
      ];
      const updates = {};

      for (const field of sensitiveFields) {
        if (item[field] !== null) {
          updates[field] = encryptedItem[field];
        }
      }

      if (Object.keys(updates).length > 0) {
        const setClause = Object.keys(updates)
          .map((key) => `${key} = ?`)
          .join(", ");
        const values = Object.values(updates);
        values.push(item.id);

        await database.execute(
          `UPDATE inventory SET ${setClause} WHERE id = ?`,
          values
        );
      }
    }

    // Get all sales records
    const salesRecords = await database.select("SELECT * FROM sales");

    console.log(`Encrypting ${salesRecords.length} sales records...`);

    // Encrypt each sales record
    for (const sale of salesRecords) {
      const encryptedSale = await encryptSalesData(sale);

      // Update only the sensitive fields
      const sensitiveFields = ["sold_to", "quantity_sold", "dimensions"];
      const updates = {};

      for (const field of sensitiveFields) {
        if (sale[field] !== null) {
          updates[field] = encryptedSale[field];
        }
      }

      if (Object.keys(updates).length > 0) {
        const setClause = Object.keys(updates)
          .map((key) => `${key} = ?`)
          .join(", ");
        const values = Object.values(updates);
        values.push(sale.id);

        await database.execute(
          `UPDATE sales SET ${setClause} WHERE id = ?`,
          values
        );
      }
    }

    console.log("✅ Database encryption migration completed successfully!");
    console.log(
      "🔒 All sensitive data is now encrypted with your access code."
    );

    return {
      success: true,
      encrypted: {
        inventory: inventoryItems.length,
        sales: salesRecords.length,
      },
    };
  } catch (error) {
    console.error("Error migrating database to encrypted format:", error);
    clearDatabaseAccessCode();
    throw error;
  }
}

// Function to encrypt inventory data before storing
async function encryptInventoryData(item) {
  if (!currentAccessCode) return item;

  const sensitiveFields = [
    "sno",
    "type",
    "weight",
    "lot",
    "sold_to",
    "coating",
    "specifications",
    "form",
  ];
  const encryptedItem = { ...item };

  for (const field of sensitiveFields) {
    if (encryptedItem[field]) {
      encryptedItem[field] = await encryptSensitiveData(
        encryptedItem[field],
        currentAccessCode
      );
    }
  }

  return encryptedItem;
}

// Function to decrypt inventory data after retrieving
async function decryptInventoryData(item) {
  if (!currentAccessCode) return item;

  const sensitiveFields = [
    "sno",
    "type",
    "weight",
    "lot",
    "sold_to",
    "coating",
    "specifications",
    "form",
  ];
  const decryptedItem = { ...item };

  for (const field of sensitiveFields) {
    if (decryptedItem[field]) {
      // Only attempt decryption if the data looks encrypted
      if (isDataEncrypted(decryptedItem[field])) {
        const decrypted = await decryptSensitiveData(
          decryptedItem[field],
          currentAccessCode
        );
        // Convert back to appropriate type
        if (field === "weight") {
          decryptedItem[field] = parseFloat(decrypted);
        } else {
          decryptedItem[field] = decrypted;
        }
      }
      // If not encrypted, leave as-is (plain text data)
    }
  }

  return decryptedItem;
}

// Function to encrypt sales data before storing
async function encryptSalesData(sale) {
  if (!currentAccessCode) return sale;

  const sensitiveFields = ["sold_to", "quantity_sold", "dimensions"];
  const encryptedSale = { ...sale };

  for (const field of sensitiveFields) {
    if (encryptedSale[field]) {
      encryptedSale[field] = await encryptSensitiveData(
        encryptedSale[field],
        currentAccessCode
      );
    }
  }

  return encryptedSale;
}

// Function to decrypt sales data after retrieving
async function decryptSalesData(sale) {
  if (!currentAccessCode) return sale;

  const sensitiveFields = ["sold_to", "quantity_sold", "dimensions"];
  const decryptedSale = { ...sale };

  for (const field of sensitiveFields) {
    if (decryptedSale[field]) {
      // Only attempt decryption if the data looks encrypted
      if (isDataEncrypted(decryptedSale[field])) {
        const decrypted = await decryptSensitiveData(
          decryptedSale[field],
          currentAccessCode
        );
        // Convert back to appropriate type
        if (field === "quantity_sold") {
          decryptedSale[field] = parseFloat(decrypted);
        } else {
          decryptedSale[field] = decrypted;
        }
      }
      // If not encrypted, leave as-is (plain text data)
    }
  }

  return decryptedSale;
}

export async function getDatabase(accessCode = null) {
  if (!db) {
    if (!accessCode && !currentAccessCode) {
      throw new Error("Access code required to initialize database");
    }
    await initializeDatabase(accessCode || currentAccessCode);
  }
  return db;
}

// Function to store a hashed code in the database
export async function storeHashedCode(hashedCode) {
  try {
    const database = await getDatabase();
    await database.execute("INSERT INTO auth_codes (code_hash) VALUES (?)", [
      hashedCode,
    ]);
    console.log("Hashed code stored successfully");
  } catch (error) {
    console.error("Error storing hashed code:", error);
    throw error;
  }
}

// Function to verify a hashed code exists in the database
export async function verifyHashedCode(hashedCode) {
  try {
    const database = await getDatabase();
    const result = await database.select(
      "SELECT id FROM auth_codes WHERE code_hash = ?",
      [hashedCode]
    );
    return result.length > 0;
  } catch (error) {
    console.error("Error verifying hashed code:", error);
    throw error;
  }
}

// Function to remove a hashed code from the database
export async function removeHashedCode(hashedCode) {
  try {
    const database = await getDatabase();
    await database.execute("DELETE FROM auth_codes WHERE code_hash = ?", [
      hashedCode,
    ]);
    console.log("Hashed code removed successfully");
  } catch (error) {
    console.error("Error removing hashed code:", error);
    throw error;
  }
}

// Inventory-related functions

// Function to add a new inventory item with dimensions (with encryption)
export async function addInventoryItem(item) {
  try {
    const database = await getDatabase();

    // Encrypt sensitive data before storing
    const encryptedItem = await encryptInventoryData(item);
    // Insert inventory item (without thickness/width)
    const result = await database.execute(
      `INSERT INTO inventory (entry_date, sno, type, weight, coating, specifications, form, lot, quality, sold_to, completed, dc_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        encryptedItem.entry_date,
        encryptedItem.sno,
        encryptedItem.type,
        encryptedItem.weight,
        encryptedItem.coating || null,
        encryptedItem.specifications || null,
        encryptedItem.form || null,
        encryptedItem.lot,
        encryptedItem.quality,
        encryptedItem.sold_to || null,
        encryptedItem.completed || 0,
        encryptedItem.dc_status || 0,
      ]
    );

    const inventoryId = result.lastInsertId; // Insert dimensions - handle both single and multiple dimensions
    if (item.dimensions && Array.isArray(item.dimensions)) {
      // Multiple dimensions
      for (const dimension of item.dimensions) {
        await database.execute(
          "INSERT INTO inventory_dimensions (inventory_id, thickness, width) VALUES (?, ?, ?)",
          [
            inventoryId,
            formatThickness(dimension.thickness),
            parseInt(formatWidth(dimension.width)),
          ]
        );
      }
    } else {
      // Single dimension (backward compatibility)
      await database.execute(
        "INSERT INTO inventory_dimensions (inventory_id, thickness, width) VALUES (?, ?, ?)",
        [
          inventoryId,
          formatThickness(item.thickness),
          parseInt(formatWidth(item.width)),
        ]
      );
    }

    console.log("Inventory item added successfully");
    return { ...result, lastInsertId: inventoryId };
  } catch (error) {
    console.error("Error adding inventory item:", error);
    throw error;
  }
}

// Function to get all inventory items with dimensions
export async function getInventoryItems(filters = {}) {
  try {
    const database = await getDatabase();
    let query = `
      SELECT i.*, 
             GROUP_CONCAT(d.thickness || 'x' || d.width, ', ') as dimensions_display,
             COUNT(d.id) as dimension_count
      FROM inventory i 
      LEFT JOIN inventory_dimensions d ON i.id = d.inventory_id 
      WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (filters.startDate) {
      query += " AND i.entry_date >= ?";
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += " AND i.entry_date <= ?";
      params.push(filters.endDate);
    }

    if (filters.type && filters.type.length > 0) {
      query += ` AND i.type IN (${filters.type.map(() => "?").join(",")})`;
      params.push(...filters.type);
    }

    if (filters.quality && filters.quality.length > 0) {
      query += ` AND i.quality IN (${filters.quality
        .map(() => "?")
        .join(",")})`;
      params.push(...filters.quality);
    }

    if (filters.lot) {
      query += " AND i.lot LIKE ?";
      params.push(`%${filters.lot}%`);
    }
    if (filters.coating) {
      query += " AND i.coating LIKE ?";
      params.push(`%${filters.coating}%`);
    }

    if (filters.specifications) {
      query += " AND i.specifications LIKE ?";
      params.push(`%${filters.specifications}%`);
    }

    if (filters.form) {
      query += " AND i.form LIKE ?";
      params.push(`%${filters.form}%`);
    }

    // Sold To filter - search in sales table for customer names
    if (filters.soldTo) {
      query +=
        " AND EXISTS (SELECT 1 FROM sales s WHERE s.inventory_id = i.id AND s.sold_to LIKE ?)";
      params.push(`%${filters.soldTo}%`);
    }

    // Thickness and width filters - need to check in dimensions table
    if (filters.minThickness !== undefined) {
      query +=
        " AND EXISTS (SELECT 1 FROM inventory_dimensions d2 WHERE d2.inventory_id = i.id AND d2.thickness >= ?)";
      params.push(filters.minThickness);
    }

    if (filters.maxThickness !== undefined) {
      query +=
        " AND EXISTS (SELECT 1 FROM inventory_dimensions d2 WHERE d2.inventory_id = i.id AND d2.thickness <= ?)";
      params.push(filters.maxThickness);
    }

    if (filters.minWidth !== undefined) {
      query +=
        " AND EXISTS (SELECT 1 FROM inventory_dimensions d2 WHERE d2.inventory_id = i.id AND d2.width >= ?)";
      params.push(filters.minWidth);
    }

    if (filters.maxWidth !== undefined) {
      query +=
        " AND EXISTS (SELECT 1 FROM inventory_dimensions d2 WHERE d2.inventory_id = i.id AND d2.width <= ?)";
      params.push(filters.maxWidth);
    }

    if (filters.minWeight !== undefined) {
      query += " AND i.weight >= ?";
      params.push(filters.minWeight);
    }

    if (filters.maxWeight !== undefined) {
      query += " AND i.weight <= ?";
      params.push(filters.maxWeight);
    }

    // Show sold items filter
    if (filters.showSoldOnly) {
      query += ' AND i.sold_to IS NOT NULL AND i.sold_to != ""';
    } else if (filters.showUnsoldOnly) {
      query += ' AND (i.sold_to IS NULL OR i.sold_to = "")';
    }

    // Show completed items filter
    if (filters.showCompletedOnly) {
      query += " AND i.completed = 1";
    } else if (filters.showIncompleteOnly) {
      query += " AND i.completed = 0";
    }

    // Show DC items filter
    if (filters.showDCOnly) {
      query += " AND i.dc_status = 1";
    } else if (filters.showNonDCOnly) {
      query += " AND i.dc_status = 0";
    }

    query += " GROUP BY i.id ORDER BY i.entry_date DESC, i.created_at DESC";

    const result = await database.select(query, params); // Get detailed dimensions for each item and decrypt sensitive data
    const itemsWithDimensions = await Promise.all(
      result.map(async (item) => {
        // Decrypt the item data first
        const decryptedItem = await decryptInventoryData(item);

        const dimensions = await database.select(
          "SELECT thickness, width FROM inventory_dimensions WHERE inventory_id = ? ORDER BY thickness, width",
          [item.id]
        ); // Format dimensions correctly - thickness with 2 decimals, width as integer
        const formattedDimensions = dimensions.map((dim) => ({
          ...dim,
          thickness: parseFloat(formatThickness(dim.thickness)),
          width: parseInt(dim.width), // width should already be integer in DB
        }));
        return {
          ...decryptedItem,
          dimensions: formattedDimensions,
          // For backward compatibility, set first dimension as primary
          thickness: parseFloat(
            formatThickness(formattedDimensions[0]?.thickness || 0)
          ),
          width: parseInt(formattedDimensions[0]?.width || 0),
        };
      })
    );

    return itemsWithDimensions;
  } catch (error) {
    console.error("Error getting inventory items:", error);
    throw error;
  }
}

// Function to update an inventory item with dimensions (with encryption)
export async function updateInventoryItem(id, updates) {
  try {
    const database = await getDatabase();

    // Extract dimensions from updates if present
    const { dimensions, thickness, width, ...inventoryUpdates } = updates;

    // Encrypt sensitive data before updating
    const encryptedUpdates = await encryptInventoryData(inventoryUpdates);

    // Update inventory table
    if (Object.keys(encryptedUpdates).length > 0) {
      const setClause = Object.keys(encryptedUpdates)
        .map((key) => `${key} = ?`)
        .join(", ");
      const values = Object.values(encryptedUpdates);
      values.push(id);

      await database.execute(
        `UPDATE inventory SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }
    // Update dimensions if provided
    if (dimensions && Array.isArray(dimensions)) {
      // Delete existing dimensions
      await database.execute(
        "DELETE FROM inventory_dimensions WHERE inventory_id = ?",
        [id]
      );
      // Insert new dimensions
      for (const dimension of dimensions) {
        await database.execute(
          "INSERT INTO inventory_dimensions (inventory_id, thickness, width) VALUES (?, ?, ?)",
          [
            id,
            formatThickness(dimension.thickness),
            parseInt(formatWidth(dimension.width)),
          ]
        );
      }
    } else if (thickness !== undefined && width !== undefined) {
      // Single dimension update (backward compatibility)
      await database.execute(
        "DELETE FROM inventory_dimensions WHERE inventory_id = ?",
        [id]
      );
      await database.execute(
        "INSERT INTO inventory_dimensions (inventory_id, thickness, width) VALUES (?, ?, ?)",
        [id, formatThickness(thickness), parseInt(formatWidth(width))]
      );
    }

    console.log("Inventory item updated successfully");
  } catch (error) {
    console.error("Error updating inventory item:", error);
    throw error;
  }
}

// Function to delete an inventory item
export async function deleteInventoryItem(id) {
  try {
    const database = await getDatabase();
    // Foreign key cascade will automatically delete dimensions
    await database.execute("DELETE FROM inventory WHERE id = ?", [id]);
    console.log("Inventory item deleted successfully");
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    throw error;
  }
}

// Function to add dimensions to an existing inventory item
export async function addDimensionsToItem(inventoryId, dimensions) {
  try {
    const database = await getDatabase();

    for (const dimension of dimensions) {
      await database.execute(
        "INSERT INTO inventory_dimensions (inventory_id, thickness, width) VALUES (?, ?, ?)",
        [
          inventoryId,
          formatThickness(dimension.thickness),
          parseInt(formatWidth(dimension.width)),
        ]
      );
    }

    console.log("Dimensions added successfully");
  } catch (error) {
    console.error("Error adding dimensions:", error);
    throw error;
  }
}

// Function to remove a specific dimension from an inventory item
export async function removeDimensionFromItem(inventoryId, thickness, width) {
  try {
    const database = await getDatabase();
    await database.execute(
      "DELETE FROM inventory_dimensions WHERE inventory_id = ? AND thickness = ? AND width = ?",
      [inventoryId, thickness, width]
    );
    console.log("Dimension removed successfully");
  } catch (error) {
    console.error("Error removing dimension:", error);
    throw error;
  }
}

// Function to get dimensions for a specific inventory item
export async function getDimensionsForItem(inventoryId) {
  try {
    const database = await getDatabase();
    const result = await database.select(
      "SELECT * FROM inventory_dimensions WHERE inventory_id = ? ORDER BY thickness, width",
      [inventoryId]
    );
    // Format dimensions correctly - thickness with 2 decimals, width as integer
    const formattedResult = result.map((dim) => ({
      ...dim,
      thickness: parseFloat(formatThickness(dim.thickness)),
      width: parseInt(dim.width), // width should already be integer in DB, but ensure it's parsed as int
    }));
    return formattedResult;
  } catch (error) {
    console.error("Error getting dimensions for item:", error);
    throw error;
  }
}

// Function to toggle completion status for all items in a lot
export async function toggleLotCompletion(lot, completed) {
  try {
    const database = await getDatabase();
    await database.execute(
      "UPDATE inventory SET completed = ?, updated_at = CURRENT_TIMESTAMP WHERE lot = ?",
      [completed ? 1 : 0, lot]
    );
    console.log("Lot completion status updated successfully");
  } catch (error) {
    console.error("Error updating lot completion status:", error);
    throw error;
  }
}

// Function to send item to DC (only if Available)
export async function sendItemToDC(id) {
  try {
    const database = await getDatabase();
    // First check if item is available (not sold) - need to decrypt the data
    const item = await database.select(
      "SELECT sold_to FROM inventory WHERE id = ?",
      [id]
    );
    if (item.length === 0) {
      throw new Error("Item not found");
    }

    // Decrypt the inventory data to check sold_to properly
    const decryptedItem = await decryptInventoryData(item[0]);
    if (decryptedItem.sold_to && decryptedItem.sold_to.trim() !== "") {
      throw new Error("Cannot send sold item to DC");
    }

    await database.execute(
      "UPDATE inventory SET dc_status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
    console.log("Item sent to DC successfully");
  } catch (error) {
    console.error("Error sending item to DC:", error);
    throw error;
  }
}

// Function to bulk send items to DC
export async function bulkSendItemsToDC(ids) {
  try {
    const database = await getDatabase();
    // Check all items are available (not sold) - need to decrypt the data
    const placeholders = ids.map(() => "?").join(",");
    const items = await database.select(
      `SELECT id, sold_to FROM inventory WHERE id IN (${placeholders})`,
      ids
    );

    // Decrypt each item to check sold_to properly
    const decryptedItems = await Promise.all(
      items.map(async (item) => ({
        ...item,
        decrypted: await decryptInventoryData(item),
      }))
    );

    const soldItems = decryptedItems.filter(
      (item) => item.decrypted.sold_to && item.decrypted.sold_to.trim() !== ""
    );

    if (soldItems.length > 0) {
      throw new Error(
        `Cannot send sold items to DC: ${soldItems.length} items are already sold`
      );
    }

    await database.execute(
      `UPDATE inventory SET dc_status = 1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      ids
    );
    console.log("Items sent to DC successfully");
  } catch (error) {
    console.error("Error bulk sending items to DC:", error);
    throw error;
  }
}

// Function to return item from DC to warehouse
export async function returnItemFromDC(id) {
  try {
    const database = await getDatabase();
    await database.execute(
      "UPDATE inventory SET dc_status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
    console.log("Item returned from DC to warehouse successfully");
  } catch (error) {
    console.error("Error returning item from DC:", error);
    throw error;
  }
}

// Function to bulk return items from DC to warehouse
export async function bulkReturnItemsFromDC(ids) {
  try {
    const database = await getDatabase();
    const placeholders = ids.map(() => "?").join(",");

    await database.execute(
      `UPDATE inventory SET dc_status = 0, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      ids
    );
    console.log("Items returned from DC to warehouse successfully");
  } catch (error) {
    console.error("Error bulk returning items from DC:", error);
    throw error;
  }
}

// Sales-related functions

// Function to add a sale for an inventory item (with encryption)
export async function addSale(
  inventoryId,
  soldTo,
  quantitySold,
  form,
  saleDate,
  dimensions = null
) {
  try {
    const database = await getDatabase();

    // Encrypt sensitive sales data
    const saleData = {
      sold_to: soldTo,
      quantity_sold: quantitySold,
      dimensions,
    };
    const encryptedSaleData = await encryptSalesData(saleData);

    await database.execute(
      "INSERT INTO sales (inventory_id, sold_to, quantity_sold, form, sale_date, dimensions) VALUES (?, ?, ?, ?, ?, ?)",
      [
        inventoryId,
        encryptedSaleData.sold_to,
        encryptedSaleData.quantity_sold,
        form,
        saleDate,
        encryptedSaleData.dimensions,
      ]
    );
    console.log("Sale added successfully");
  } catch (error) {
    console.error("Error adding sale:", error);
    throw error;
  }
}

// Function to get all sales for a specific inventory item (with decryption)
export async function getSalesForItem(inventoryId) {
  try {
    const database = await getDatabase();
    const result = await database.select(
      "SELECT * FROM sales WHERE inventory_id = ? ORDER BY sale_date DESC, created_at DESC",
      [inventoryId]
    );

    // Decrypt sales data before returning
    const decryptedSales = await Promise.all(
      result.map(async (sale) => await decryptSalesData(sale))
    );

    return decryptedSales;
  } catch (error) {
    console.error("Error getting sales for item:", error);
    throw error;
  }
}

// Function to delete a sale
export async function deleteSale(saleId) {
  try {
    const database = await getDatabase();
    await database.execute("DELETE FROM sales WHERE id = ?", [saleId]);
    console.log("Sale deleted successfully");
  } catch (error) {
    console.error("Error deleting sale:", error);
    throw error;
  }
}

// Function to update a sale (with encryption)
export async function updateSale(saleId, updates) {
  try {
    const database = await getDatabase();

    // Encrypt sensitive data in updates
    const encryptedUpdates = await encryptSalesData(updates);

    const fields = Object.keys(encryptedUpdates);
    const values = Object.values(encryptedUpdates);
    const setClause = fields.map((field) => `${field} = ?`).join(", ");

    await database.execute(
      `UPDATE sales SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, saleId]
    );
    console.log("Sale updated successfully");
  } catch (error) {
    console.error("Error updating sale:", error);
    throw error;
  }
}

// Function to get total sold quantity for an inventory item
export async function getTotalSoldQuantity(inventoryId) {
  try {
    const database = await getDatabase();

    // Get all sales records for this inventory item
    const salesRecords = await database.select(
      "SELECT quantity_sold FROM sales WHERE inventory_id = ?",
      [inventoryId]
    );

    // If no sales records, return 0
    if (salesRecords.length === 0) {
      return 0;
    }

    // Decrypt each sales record and sum the quantities
    let totalSold = 0;
    for (const sale of salesRecords) {
      const decryptedSale = await decryptSalesData(sale);
      const quantity = parseFloat(decryptedSale.quantity_sold) || 0;
      totalSold += quantity;
    }

    return parseFloat(totalSold.toFixed(2));
  } catch (error) {
    console.error("Error getting total sold quantity:", error);
    throw error;
  }
}

// Function to calculate balance for an inventory item
export async function getItemBalance(inventoryId, originalWeight) {
  try {
    const totalSold = await getTotalSoldQuantity(inventoryId);
    return parseFloat((originalWeight - totalSold).toFixed(2));
  } catch (error) {
    console.error("Error calculating item balance:", error);
    throw error;
  }
}

// Function to get inventory items with calculated balance (with decryption)
export async function getInventoryItemsWithBalance(filters = {}) {
  try {
    const items = await getInventoryItems(filters);

    // Get all sales data in one query for efficiency
    const database = await getDatabase();
    const allSales = await database.select(
      "SELECT inventory_id, sold_to FROM sales ORDER BY inventory_id"
    );

    // Decrypt sales data
    const decryptedSales = await Promise.all(
      allSales.map(async (sale) => await decryptSalesData(sale))
    );

    // Group sales by inventory_id
    const salesByItem = {};
    decryptedSales.forEach((sale) => {
      if (!salesByItem[sale.inventory_id]) {
        salesByItem[sale.inventory_id] = [];
      }
      salesByItem[sale.inventory_id].push(sale.sold_to);
    });

    // Calculate balance for each item and add sales info
    const itemsWithBalance = await Promise.all(
      items.map(async (item) => {
        const balance = await getItemBalance(item.id, item.weight);
        return {
          ...item,
          balance: parseFloat(balance.toFixed(2)),
          salesCustomers: salesByItem[item.id] || [],
        };
      })
    );

    return itemsWithBalance;
  } catch (error) {
    console.error("Error getting inventory items with balance:", error);
    throw error;
  }
}

// CSV Import functionality with comprehensive duplicate prevention
//
// Duplicate Prevention Mechanisms:
// 1. Inventory Import:
//    - Primary check: S.No (Serial Number) uniqueness
//    - Secondary check: Combination of entry_date, type, weight, lot, quality
// 2. Sales Import:
//    - Check: Exact match on inventory_id, sale_date, sold_to, quantity_sold, form
//    - Weight validation: Ensures sales don't exceed remaining item weight
// 3. Combined Import:
//    - Groups items by S.No to handle multiple sales per item
//    - All inventory and sales duplicate checks apply
//    - Cumulative weight validation for multiple sales
//
export async function importInventoryFromCSV(csvData) {
  try {
    const database = await getDatabase();
    const importResults = {
      success: 0,
      errors: [],
      skipped: 0,
    };

    // Helper function to clean coating values - removes leading single quote if present
    const cleanCoating = (coatingValue) => {
      if (!coatingValue) return null;
      const cleaned = coatingValue.trim();
      // Remove leading single quote if present (from Excel export format)
      if (cleaned.startsWith("'")) {
        return cleaned.substring(1);
      }
      return cleaned;
    };

    // Parse CSV data - expect header row and data rows
    const lines = csvData.trim().split("\n");
    if (lines.length < 2) {
      throw new Error(
        "CSV file must contain at least a header row and one data row"
      );
    } // Extract and validate headers
    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    const expectedHeaders = [
      "Entry Date",
      "S.No",
      "Type",
      "Dimensions",
      "Weight",
      "Coating",
      "Specifications",
      "Item Form",
      "LOT",
      "Quality",
      "Balance",
    ];

    // Check if headers match expected format
    const headerMatches = expectedHeaders.every(
      (expected, index) =>
        headers[index] &&
        headers[index].toLowerCase() === expected.toLowerCase()
    );

    if (!headerMatches) {
      throw new Error(
        `CSV headers don't match expected format. Expected: ${expectedHeaders.join(
          ", "
        )}`
      );
    }

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      try {
        // Parse CSV row - handle quoted values
        const values = [];
        let currentValue = "";
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = "";
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim()); // Add the last value

        if (values.length !== expectedHeaders.length) {
          importResults.errors.push(
            `Row ${i + 1}: Expected ${expectedHeaders.length} columns, got ${
              values.length
            }`
          );
          continue;
        }
        // Extract values
        const [
          entryDate,
          sno,
          type,
          dimensionsStr,
          weight,
          coating,
          specifications,
          form,
          lot,
          quality,
          balance,
        ] = values;
        // Validate required fields
        if (!entryDate || !sno || !type || !weight || !lot || !quality) {
          importResults.errors.push(
            `Row ${
              i + 1
            }: Missing required fields (Entry Date, S.No, Type, Weight, LOT, Quality)`
          );
          continue;
        } // Validate and format entry date first
        let formattedDate;
        try {
          // Handle different date formats (dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd, etc.)
          if (entryDate.includes("/")) {
            const [day, month, year] = entryDate.split("/");
            formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(
              2,
              "0"
            )}`;
          } else if (entryDate.includes("-")) {
            const parts = entryDate.split("-");
            if (parts.length === 3) {
              // Check if it's dd-MM-yyyy or yyyy-MM-dd format
              if (parts[0].length === 4) {
                // yyyy-MM-dd format
                formattedDate = entryDate;
              } else {
                // dd-MM-yyyy format
                const [day, month, year] = parts;
                formattedDate = `${year}-${month.padStart(
                  2,
                  "0"
                )}-${day.padStart(2, "0")}`;
              }
            } else {
              throw new Error("Invalid date format");
            }
          } else {
            formattedDate = entryDate; // Assume it's already in yyyy-MM-dd format
          }

          // Validate date
          const dateObj = new Date(formattedDate);
          if (isNaN(dateObj.getTime())) {
            throw new Error("Invalid date");
          }
        } catch (error) {
          importResults.errors.push(
            `Row ${i + 1}: Invalid date format "${entryDate}"`
          );
          continue;
        }

        // Validate weight
        const weightNum = parseFloat(weight);
        if (isNaN(weightNum) || weightNum <= 0) {
          importResults.errors.push(
            `Row ${
              i + 1
            }: Invalid weight "${weight}". Must be a positive number`
          );
          continue;
        }
        // Check if item with same S.No already exists - need to decrypt to compare
        const allItems = await database.select("SELECT id, sno FROM inventory");
        let isDuplicateSno = false;
        for (const item of allItems) {
          const decryptedItem = await decryptInventoryData(item);
          if (decryptedItem.sno === sno) {
            isDuplicateSno = true;
            break;
          }
        }

        if (isDuplicateSno) {
          importResults.skipped++;
          importResults.errors.push(
            `Row ${i + 1}: Item with S.No "${sno}" already exists, skipped`
          );
          continue;
        }
        try {
          // Handle different date formats (dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd, etc.)
          if (entryDate.includes("/")) {
            const [day, month, year] = entryDate.split("/");
            formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(
              2,
              "0"
            )}`;
          } else if (entryDate.includes("-")) {
            const parts = entryDate.split("-");
            if (parts.length === 3) {
              // Check if it's dd-MM-yyyy or yyyy-MM-dd format
              if (parts[0].length === 4) {
                // yyyy-MM-dd format
                formattedDate = entryDate;
              } else {
                // dd-MM-yyyy format
                const [day, month, year] = parts;
                formattedDate = `${year}-${month.padStart(
                  2,
                  "0"
                )}-${day.padStart(2, "0")}`;
              }
            } else {
              throw new Error("Invalid date format");
            }
          } else {
            formattedDate = entryDate; // Assume it's already in yyyy-MM-dd format
          }

          // Validate date
          const dateObj = new Date(formattedDate);
          if (isNaN(dateObj.getTime())) {
            throw new Error("Invalid date");
          }
        } catch (error) {
          importResults.errors.push(
            `Row ${i + 1}: Invalid date format "${entryDate}"`
          );
          continue;
        }
        // Validate type
        const validTypes = [
          "E",
          "GA",
          "GA1",
          "4",
          "5",
          "4N",
          "4G",
          "Scrap",
          "Paint",
          "Others",
        ];
        if (!validTypes.includes(type)) {
          importResults.errors.push(
            `Row ${
              i + 1
            }: Invalid type "${type}". Must be one of: ${validTypes.join(", ")}`
          );
          continue;
        }

        // Validate quality
        const validQualities = ["Soft", "Hard", "Semi"];
        if (!validQualities.includes(quality)) {
          importResults.errors.push(
            `Row ${
              i + 1
            }: Invalid quality "${quality}". Must be one of: ${validQualities.join(
              ", "
            )}`
          );
          continue;
        }
        // Parse dimensions (format: "thick1×width1; thick2×width2" or "thick×width")
        const dimensions = [];
        if (
          dimensionsStr &&
          dimensionsStr !== "—" &&
          dimensionsStr.trim() !== ""
        ) {
          try {
            const dimParts = dimensionsStr.split(";").map((d) => d.trim());
            for (const dimPart of dimParts) {
              if (dimPart) {
                const [thickness, width] = dimPart
                  .split("×")
                  .map((d) => parseFloat(d.trim()));
                if (
                  !isNaN(thickness) &&
                  !isNaN(width) &&
                  thickness > 0 &&
                  width > 0
                ) {
                  dimensions.push({
                    thickness: parseFloat(formatThickness(thickness)),
                    width: parseInt(Math.round(width)), // Convert width to integer
                  });
                }
              }
            }
          } catch (error) {
            // If dimension parsing fails, create a default dimension
            dimensions.push({ thickness: 0, width: 0 });
          }
        }
        // If no dimensions parsed, create a default one
        if (dimensions.length === 0) {
          dimensions.push({ thickness: 0, width: 0 });
        }

        // Encrypt inventory data before storing
        const inventoryData = {
          entry_date: formattedDate,
          sno: sno,
          type: type,
          weight: weightNum,
          coating: cleanCoating(coating),
          specifications: specifications || null,
          form: form || null,
          lot: lot,
          quality: quality,
          sold_to: null,
          completed: 0,
          dc_status: 0,
        };
        const encryptedInventoryData = await encryptInventoryData(
          inventoryData
        );

        // Insert encrypted inventory item
        const result = await database.execute(
          `INSERT INTO inventory (entry_date, sno, type, weight, coating, specifications, form, lot, quality, sold_to, completed, dc_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            encryptedInventoryData.entry_date,
            encryptedInventoryData.sno,
            encryptedInventoryData.type,
            encryptedInventoryData.weight,
            encryptedInventoryData.coating,
            encryptedInventoryData.specifications,
            encryptedInventoryData.form,
            encryptedInventoryData.lot,
            encryptedInventoryData.quality,
            encryptedInventoryData.sold_to,
            encryptedInventoryData.completed,
            encryptedInventoryData.dc_status,
          ]
        );
        const inventoryId = result.lastInsertId;

        // Insert dimensions
        for (const dimension of dimensions) {
          await database.execute(
            "INSERT INTO inventory_dimensions (inventory_id, thickness, width) VALUES (?, ?, ?)",
            [
              inventoryId,
              formatThickness(dimension.thickness),
              parseInt(dimension.width),
            ]
          );
        }

        importResults.success++;
      } catch (error) {
        importResults.errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    return importResults;
  } catch (error) {
    console.error("Error importing CSV:", error);
    throw error;
  }
}

// Import sales data from CSV
export async function importSalesFromCSV(csvData) {
  try {
    const database = await getDatabase();
    const importResults = {
      success: 0,
      errors: [],
      skipped: 0,
    };

    // Helper function to clean quoted values
    const cleanValue = (value) => {
      if (typeof value === "string") {
        return value.replace(/^"(.*)"$/, "$1").trim();
      }
      return value;
    };

    // Helper function to clean coating values - removes leading single quote if present
    const cleanCoating = (coatingValue) => {
      if (!coatingValue) return null;
      const cleaned = coatingValue.trim();
      // Remove leading single quote if present (from Excel export format)
      if (cleaned.startsWith("'")) {
        return cleaned.substring(1);
      }
      return cleaned;
    };

    // Parse CSV data - expect header row and data rows
    const lines = csvData.trim().split("\n");
    if (lines.length < 2) {
      throw new Error(
        "CSV file must contain at least a header row and one data row"
      );
    }

    // Extract and validate headers
    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    // Support two different CSV formats:
    // Format 1 (Dashboard export): ['Sale Date', 'Entry Number', 'Item Type', 'Dimensions', 'Sold To', 'Quantity Sold', 'Form', 'Item Coating', 'Item Specifications', 'Item Form', 'Item LOT', 'Item Quality']
    // Format 2 (SalesManagementDialog export): ['Sale Date', 'Dimensions', 'Sold To', 'Quantity Sold', 'Form', 'Entry Number', 'Item Type', 'Item Coating', 'Item Specifications', 'Item Form', 'Item LOT', 'Item Quality']

    const dashboardFormat = [
      "Sale Date",
      "Entry Number",
      "Item Type",
      "Dimensions",
      "Sold To",
      "Quantity Sold",
      "Form",
      "Item Coating",
      "Item Specifications",
      "Item Form",
      "Item LOT",
      "Item Quality",
    ];
    const salesDialogFormat = [
      "Sale Date",
      "Dimensions",
      "Sold To",
      "Quantity Sold",
      "Form",
      "Entry Number",
      "Item Type",
      "Item Coating",
      "Item Specifications",
      "Item Form",
      "Item LOT",
      "Item Quality",
    ];

    let formatType = null;
    let expectedHeaders = null;

    // Check which format matches
    const dashboardMatches = dashboardFormat.every(
      (expected, index) =>
        headers[index] &&
        headers[index].toLowerCase() === expected.toLowerCase()
    );

    const salesDialogMatches = salesDialogFormat.every(
      (expected, index) =>
        headers[index] &&
        headers[index].toLowerCase() === expected.toLowerCase()
    );

    if (dashboardMatches) {
      formatType = "dashboard";
      expectedHeaders = dashboardFormat;
    } else if (salesDialogMatches) {
      formatType = "salesDialog";
      expectedHeaders = salesDialogFormat;
    } else {
      throw new Error(
        `CSV headers don't match any supported format.\nSupported formats:\n1. Dashboard export: ${dashboardFormat.join(
          ", "
        )}\n2. Sales dialog export: ${salesDialogFormat.join(", ")}`
      );
    }

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      try {
        // Parse CSV row - handle quoted values and clean them
        const rawValues = [];
        let currentValue = "";
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            rawValues.push(currentValue.trim());
            currentValue = "";
          } else {
            currentValue += char;
          }
        }
        rawValues.push(currentValue.trim()); // Add the last value

        // Clean quoted values
        const values = rawValues.map(cleanValue);

        if (values.length !== expectedHeaders.length) {
          importResults.errors.push(
            `Row ${i + 1}: Expected ${expectedHeaders.length} columns, got ${
              values.length
            }`
          );
          continue;
        } // Extract values based on format type
        let saleDate,
          entryNumber,
          itemType,
          dimensions,
          soldTo,
          quantitySold,
          form,
          itemCoating,
          itemSpecifications,
          itemForm,
          itemLot,
          itemQuality;

        if (formatType === "dashboard") {
          // Dashboard format: ['Sale Date', 'Entry Number', 'Item Type', 'Dimensions', 'Sold To', 'Quantity Sold', 'Form', 'Item Coating', 'Item Specifications', 'Item Form', 'Item LOT', 'Item Quality']
          [
            saleDate,
            entryNumber,
            itemType,
            dimensions,
            soldTo,
            quantitySold,
            form,
            itemCoating,
            itemSpecifications,
            itemForm,
            itemLot,
            itemQuality,
          ] = values;
        } else if (formatType === "salesDialog") {
          // Sales dialog format: ['Sale Date', 'Dimensions', 'Sold To', 'Quantity Sold', 'Form', 'Entry Number', 'Item Type', 'Item Coating', 'Item Specifications', 'Item Form', 'Item LOT', 'Item Quality']
          [
            saleDate,
            dimensions,
            soldTo,
            quantitySold,
            form,
            entryNumber,
            itemType,
            itemCoating,
            itemSpecifications,
            itemForm,
            itemLot,
            itemQuality,
          ] = values;
        }

        // Validate required fields
        if (!saleDate || !entryNumber || !soldTo || !quantitySold) {
          importResults.errors.push(
            `Row ${
              i + 1
            }: Missing required fields (Sale Date, Entry Number, Sold To, Quantity Sold)`
          );
          continue;
        }

        // Find the inventory item by entry number (sno) - need to decrypt to compare
        const allInventoryItems = await database.select(
          "SELECT id, weight, sno FROM inventory"
        );
        let inventoryId = null;
        let itemWeight = null;

        for (const item of allInventoryItems) {
          const decryptedItem = await decryptInventoryData(item);
          if (decryptedItem.sno === entryNumber) {
            inventoryId = item.id;
            itemWeight = decryptedItem.weight;
            break;
          }
        }

        if (!inventoryId) {
          importResults.errors.push(
            `Row ${
              i + 1
            }: No inventory item found with Entry Number "${entryNumber}"`
          );
          continue;
        } // Get the inventory item's dimensions
        const itemDimensions = await database.select(
          "SELECT thickness, width FROM inventory_dimensions WHERE inventory_id = ? ORDER BY thickness, width",
          [inventoryId]
        );

        // Convert dimensions to the format used in sales (array of "thickness×width" strings)
        const dimensionsArray = itemDimensions.map(
          (dim) => `${formatThickness(dim.thickness)}×${dim.width}`
        );
        const dimensionsJson = JSON.stringify(dimensionsArray);
        // Validate and format sale date
        let formattedDate;
        try {
          // Handle different date formats (dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd, etc.)
          if (saleDate.includes("/")) {
            const [day, month, year] = saleDate.split("/");
            formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(
              2,
              "0"
            )}`;
          } else if (saleDate.includes("-")) {
            const parts = saleDate.split("-");
            if (parts.length === 3) {
              // Check if it's dd-MM-yyyy or yyyy-MM-dd format
              if (parts[0].length === 4) {
                // yyyy-MM-dd format
                formattedDate = saleDate;
              } else {
                // dd-MM-yyyy format
                const [day, month, year] = parts;
                formattedDate = `${year}-${month.padStart(
                  2,
                  "0"
                )}-${day.padStart(2, "0")}`;
              }
            } else {
              throw new Error("Invalid date format");
            }
          } else {
            formattedDate = saleDate; // Assume it's already in yyyy-MM-dd format
          }

          // Validate date
          const dateObj = new Date(formattedDate);
          if (isNaN(dateObj.getTime())) {
            throw new Error("Invalid date");
          }
        } catch (error) {
          importResults.errors.push(
            `Row ${i + 1}: Invalid date format "${saleDate}"`
          );
          continue;
        }

        // Validate quantity sold
        const quantityNum = parseFloat(quantitySold);
        if (isNaN(quantityNum) || quantityNum <= 0) {
          importResults.errors.push(
            `Row ${
              i + 1
            }: Invalid quantity "${quantitySold}". Must be a positive number`
          );
          continue;
        } // Check if quantity doesn't exceed available weight
        // Use the fixed function that handles encrypted data properly
        const totalSold = await getTotalSoldQuantity(inventoryId);
        const remainingWeight = itemWeight - totalSold;
        if (quantityNum > remainingWeight) {
          importResults.errors.push(
            `Row ${
              i + 1
            }: Quantity ${quantityNum} exceeds remaining weight ${remainingWeight} for item ${entryNumber}`
          );
          continue;
        }
        // Check if this exact sale already exists - need to decrypt existing sales to compare
        const existingSales = await database.select(
          "SELECT id, sold_to, quantity_sold FROM sales WHERE inventory_id = ? AND sale_date = ? AND form = ?",
          [inventoryId, formattedDate, form || null]
        );

        let isDuplicate = false;
        for (const existingSale of existingSales) {
          const decryptedSale = await decryptSalesData(existingSale);
          if (
            decryptedSale.sold_to === soldTo &&
            parseFloat(decryptedSale.quantity_sold) === quantityNum
          ) {
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) {
          importResults.skipped++;
          importResults.errors.push(
            `Row ${
              i + 1
            }: Sale already exists for item ${entryNumber} on ${formattedDate} to ${soldTo}`
          );
          continue;
        }

        // Encrypt sales data before storing
        const salesData = {
          sold_to: soldTo,
          quantity_sold: quantityNum,
          dimensions: dimensionsJson,
        };
        const encryptedSalesData = await encryptSalesData(salesData);

        // Insert encrypted sales record with dimensions
        await database.execute(
          `INSERT INTO sales (inventory_id, sale_date, sold_to, quantity_sold, form, dimensions)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            inventoryId,
            formattedDate,
            encryptedSalesData.sold_to,
            encryptedSalesData.quantity_sold,
            form || null,
            encryptedSalesData.dimensions,
          ]
        );

        importResults.success++;
      } catch (error) {
        importResults.errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    return importResults;
  } catch (error) {
    console.error("Error importing sales CSV:", error);
    throw error;
  }
}

// Import combined inventory and sales data from CSV
export async function importCombinedFromCSV(csvData) {
  try {
    const database = await getDatabase();
    const importResults = {
      success: 0,
      errors: [],
      skipped: 0,
      inventoryImported: 0,
      salesImported: 0,
    };

    // Helper function to clean quoted values
    const cleanValue = (value) => {
      if (typeof value === "string") {
        return value.replace(/^"(.*)"$/, "$1").trim();
      }
      return value;
    };

    // Helper function to clean coating values - removes leading single quote if present
    const cleanCoating = (coatingValue) => {
      if (!coatingValue) return null;
      const cleaned = coatingValue.trim();
      // Remove leading single quote if present (from Excel export format)
      if (cleaned.startsWith("'")) {
        return cleaned.substring(1);
      }
      return cleaned;
    };

    // Parse CSV data - expect header row and data rows
    const lines = csvData.trim().split("\n");
    if (lines.length < 2) {
      throw new Error(
        "CSV file must contain at least a header row and one data row"
      );
    } // Extract and validate headers - handle both tab and comma separated
    let headers, separator;

    // Try tab-separated first
    const tabHeaders = lines[0]
      .split("\t")
      .map((h) => h.replace(/"/g, "").trim());
    const commaHeaders = lines[0]
      .split(",")
      .map((h) => h.replace(/"/g, "").trim());
    // Determine which separator to use based on which gives us the right number of columns
    const expectedHeaders = [
      "Entry Date",
      "S.No",
      "Type",
      "Item Dimensions",
      "Weight",
      "Coating",
      "Specifications",
      "Item Form",
      "LOT",
      "Quality",
      "Balance",
      "Sale Date",
      "Sale Dimensions",
      "Sold To",
      "Quantity Sold",
      "Form",
    ];

    if (tabHeaders.length === expectedHeaders.length) {
      headers = tabHeaders;
      separator = "\t";
    } else if (commaHeaders.length === expectedHeaders.length) {
      headers = commaHeaders;
      separator = ",";
    } else {
      // If neither works, default to tab and show debug info
      headers = tabHeaders;
      separator = "\t";
    }

    // Debug: Log the actual headers found
    console.log("Using separator:", separator === "\t" ? "TAB" : "COMMA");
    console.log("Actual headers found:", headers);
    console.log("Expected headers:", expectedHeaders);
    console.log(
      "Headers length:",
      headers.length,
      "Expected length:",
      expectedHeaders.length
    );

    // Check if headers match expected format
    const headerMatches = expectedHeaders.every(
      (expected, index) =>
        headers[index] &&
        headers[index].toLowerCase() === expected.toLowerCase()
    );

    if (!headerMatches) {
      // Show detailed mismatch information
      const mismatches = [];
      for (
        let i = 0;
        i < Math.max(headers.length, expectedHeaders.length);
        i++
      ) {
        const actual = headers[i] || "MISSING";
        const expected = expectedHeaders[i] || "EXTRA";
        if (
          !headers[i] ||
          !expectedHeaders[i] ||
          headers[i].toLowerCase() !== expectedHeaders[i].toLowerCase()
        ) {
          mismatches.push(
            `Column ${i + 1}: Got "${actual}", Expected "${expected}"`
          );
        }
      }
      throw new Error(
        `CSV headers don't match expected format.\nMismatches:\n${mismatches.join(
          "\n"
        )}\n\nExpected: ${expectedHeaders.join(", ")}`
      );
    }

    // Group rows by entry number to handle items with multiple sales
    const itemsMap = new Map();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      try {
        // Parse CSV row - handle detected separator and clean values
        const rawValues = line.split(separator).map((v) => v.trim());
        const values = rawValues.map(cleanValue);

        if (values.length !== expectedHeaders.length) {
          importResults.errors.push(
            `Row ${i + 1}: Expected ${expectedHeaders.length} columns, got ${
              values.length
            }`
          );
          continue;
        }
        // Extract values (now cleaned of quotes)
        const [
          entryDate,
          sno,
          type,
          itemDimensionsStr,
          weight,
          coating,
          specifications,
          itemForm,
          lot,
          quality,
          balance,
          saleDate,
          saleDimensionsStr,
          soldTo,
          quantitySold,
          form,
        ] = values;
        // Group by S.No
        if (!itemsMap.has(sno)) {
          itemsMap.set(sno, {
            inventory: {
              entryDate,
              sno,
              type,
              itemDimensionsStr,
              weight,
              coating,
              specifications,
              itemForm,
              lot,
              quality,
              balance,
            },
            sales: [],
          });
        }

        // Add sale if it exists
        if (
          saleDate &&
          saleDate !== "—" &&
          soldTo &&
          soldTo !== "—" &&
          quantitySold &&
          quantitySold !== "—"
        ) {
          itemsMap
            .get(sno)
            .sales.push({
              saleDate,
              saleDimensionsStr,
              soldTo,
              quantitySold,
              form,
            });
        }
      } catch (error) {
        importResults.errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    // Process each unique item
    for (const [sno, itemData] of itemsMap) {
      try {
        const { inventory, sales } = itemData;
        const {
          entryDate,
          type,
          itemDimensionsStr,
          weight,
          coating,
          specifications,
          itemForm,
          lot,
          quality,
        } = inventory;

        // Validate required inventory fields
        if (!entryDate || !sno || !type || !weight || !lot || !quality) {
          importResults.errors.push(
            `Item ${sno}: Missing required inventory fields`
          );
          continue;
        } // Check if item with same S.No already exists - need to decrypt to compare
        const allInventoryItems = await database.select(
          "SELECT id, sno FROM inventory"
        );
        let existingInventoryId = null;

        for (const item of allInventoryItems) {
          const decryptedItem = await decryptInventoryData(item);
          if (decryptedItem.sno === sno) {
            existingInventoryId = item.id;
            break;
          }
        }

        if (existingInventoryId) {
          // Item exists, we'll only process sales
          importResults.skipped++;
          // Process sales for existing item
          if (sales.length > 0) {
            // Get the inventory item's dimensions for sales records
            const itemDimensions = await database.select(
              "SELECT thickness, width FROM inventory_dimensions WHERE inventory_id = ? ORDER BY thickness, width",
              [existingInventoryId]
            );

            // Convert dimensions to the format used in sales (array of "thickness×width" strings)
            const dimensionsArray = itemDimensions.map(
              (dim) => `${formatThickness(dim.thickness)}×${dim.width}`
            );
            const dimensionsJson = JSON.stringify(dimensionsArray);
            // Process each sale for the existing item
            for (const sale of sales) {
              try {
                const { saleDate, soldTo, quantitySold, form } = sale;

                // Validate sale date
                let formattedSaleDate;
                if (saleDate.includes("/")) {
                  const [day, month, year] = saleDate.split("/");
                  formattedSaleDate = `${year}-${month.padStart(
                    2,
                    "0"
                  )}-${day.padStart(2, "0")}`;
                } else if (saleDate.includes("-")) {
                  const parts = saleDate.split("-");
                  if (parts.length === 3) {
                    // Check if it's dd-MM-yyyy or yyyy-MM-dd format
                    if (parts[0].length === 4) {
                      // yyyy-MM-dd format
                      formattedSaleDate = saleDate;
                    } else {
                      // dd-MM-yyyy format
                      const [day, month, year] = parts;
                      formattedSaleDate = `${year}-${month.padStart(
                        2,
                        "0"
                      )}-${day.padStart(2, "0")}`;
                    }
                  } else {
                    formattedSaleDate = saleDate;
                  }
                } else {
                  formattedSaleDate = saleDate;
                }
                const quantityNum = parseFloat(quantitySold);
                if (isNaN(quantityNum) || quantityNum <= 0) {
                  importResults.errors.push(
                    `Item ${sno}: Invalid sale quantity "${quantitySold}"`
                  );
                  continue;
                }
                // Check if quantity doesn't exceed available weight
                // Use the fixed function that handles encrypted data properly
                const totalSoldForItem = await getTotalSoldQuantity(
                  existingInventoryId
                );
                const itemWeightData = await database.select(
                  "SELECT weight FROM inventory WHERE id = ?",
                  [existingInventoryId]
                );
                const itemWeight = itemWeightData[0]?.weight || 0;
                const remainingWeight = itemWeight - totalSoldForItem;

                if (quantityNum > remainingWeight) {
                  importResults.errors.push(
                    `Item ${sno}: Sale quantity ${quantityNum} exceeds remaining weight ${remainingWeight}`
                  );
                  continue;
                }
                // Check if this exact sale already exists - need to decrypt to compare
                const existingSales = await database.select(
                  "SELECT id, sold_to, quantity_sold FROM sales WHERE inventory_id = ? AND sale_date = ? AND form = ?",
                  [existingInventoryId, formattedSaleDate, form || null]
                );

                let isDuplicateSale = false;
                for (const existingSale of existingSales) {
                  const decryptedSale = await decryptSalesData(existingSale);
                  if (
                    decryptedSale.sold_to === soldTo &&
                    parseFloat(decryptedSale.quantity_sold) === quantityNum
                  ) {
                    isDuplicateSale = true;
                    break;
                  }
                }

                if (!isDuplicateSale) {
                  // Encrypt sales data before storing
                  const existingSalesData = {
                    sold_to: soldTo,
                    quantity_sold: quantityNum,
                    dimensions: dimensionsJson,
                  };
                  const encryptedExistingSalesData = await encryptSalesData(
                    existingSalesData
                  );

                  // Sale doesn't exist, add it
                  await database.execute(
                    `INSERT INTO sales (inventory_id, sale_date, sold_to, quantity_sold, form, dimensions)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                      existingInventoryId,
                      formattedSaleDate,
                      encryptedExistingSalesData.sold_to,
                      encryptedExistingSalesData.quantity_sold,
                      form || null,
                      encryptedExistingSalesData.dimensions,
                    ]
                  );

                  importResults.salesImported++;
                }
              } catch (error) {
                importResults.errors.push(`Item ${sno} sale: ${error.message}`);
              }
            }
          }
          continue; // Skip to next item since inventory already exists
        }
        // Validate and format entry date
        let formattedDate;
        try {
          if (entryDate.includes("/")) {
            const [day, month, year] = entryDate.split("/");
            formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(
              2,
              "0"
            )}`;
          } else if (entryDate.includes("-")) {
            const parts = entryDate.split("-");
            if (parts.length === 3) {
              // Check if it's dd-MM-yyyy or yyyy-MM-dd format
              if (parts[0].length === 4) {
                // yyyy-MM-dd format
                formattedDate = entryDate;
              } else {
                // dd-MM-yyyy format
                const [day, month, year] = parts;
                formattedDate = `${year}-${month.padStart(
                  2,
                  "0"
                )}-${day.padStart(2, "0")}`;
              }
            } else {
              throw new Error("Invalid date format");
            }
          } else {
            formattedDate = entryDate;
          }

          const dateObj = new Date(formattedDate);
          if (isNaN(dateObj.getTime())) {
            throw new Error("Invalid date");
          }
        } catch (error) {
          importResults.errors.push(
            `Item ${sno}: Invalid date format "${entryDate}"`
          );
          continue;
        } // Validate weight (already cleaned of quotes)
        const weightNum = parseFloat(weight);
        if (isNaN(weightNum) || weightNum <= 0) {
          importResults.errors.push(`Item ${sno}: Invalid weight "${weight}"`);
          continue;
        } // Parse dimensions
        const dimensions = [];
        if (
          itemDimensionsStr &&
          itemDimensionsStr !== "—" &&
          itemDimensionsStr.trim() !== ""
        ) {
          try {
            const dimParts = itemDimensionsStr.split(";").map((d) => d.trim());
            for (const dimPart of dimParts) {
              if (dimPart) {
                const [thickness, width] = dimPart
                  .split("×")
                  .map((d) => parseFloat(d.trim()));
                if (
                  !isNaN(thickness) &&
                  !isNaN(width) &&
                  thickness > 0 &&
                  width > 0
                ) {
                  dimensions.push({
                    thickness: parseFloat(formatThickness(thickness)),
                    width: parseInt(Math.round(width)), // Convert width to integer
                  });
                }
              }
            }
          } catch (error) {
            dimensions.push({ thickness: 0, width: 0 });
          }
        }
        if (dimensions.length === 0) {
          dimensions.push({ thickness: 0, width: 0 });
        }

        // Encrypt inventory data before storing
        const combinedInventoryData = {
          entry_date: formattedDate,
          sno: sno,
          type: type,
          weight: weightNum,
          coating: cleanCoating(coating),
          specifications: specifications || null,
          form: itemForm || null,
          lot: lot,
          quality: quality,
          sold_to: null,
          completed: 0,
          dc_status: 0,
        };
        const encryptedCombinedInventoryData = await encryptInventoryData(
          combinedInventoryData
        );

        // Insert encrypted inventory item
        const result = await database.execute(
          `INSERT INTO inventory (entry_date, sno, type, weight, coating, specifications, form, lot, quality, sold_to, completed, dc_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            encryptedCombinedInventoryData.entry_date,
            encryptedCombinedInventoryData.sno,
            encryptedCombinedInventoryData.type,
            encryptedCombinedInventoryData.weight,
            encryptedCombinedInventoryData.coating,
            encryptedCombinedInventoryData.specifications,
            encryptedCombinedInventoryData.form,
            encryptedCombinedInventoryData.lot,
            encryptedCombinedInventoryData.quality,
            encryptedCombinedInventoryData.sold_to,
            encryptedCombinedInventoryData.completed,
            encryptedCombinedInventoryData.dc_status,
          ]
        );
        const inventoryId = result.lastInsertId;

        // Insert dimensions
        for (const dimension of dimensions) {
          await database.execute(
            "INSERT INTO inventory_dimensions (inventory_id, thickness, width) VALUES (?, ?, ?)",
            [
              inventoryId,
              formatThickness(dimension.thickness),
              parseInt(dimension.width),
            ]
          );
        }
        importResults.inventoryImported++;
        // Get the inventory item's dimensions for sales records
        const itemDimensions = await database.select(
          "SELECT thickness, width FROM inventory_dimensions WHERE inventory_id = ? ORDER BY thickness, width",
          [inventoryId]
        );
        // Convert dimensions to the format used in sales (array of "thickness×width" strings)
        const dimensionsArray = itemDimensions.map(
          (dim) => `${formatThickness(dim.thickness)}×${dim.width}`
        );
        const dimensionsJson = JSON.stringify(dimensionsArray); // Insert sales records
        let cumulativeSalesQuantity = 0;
        for (const sale of sales) {
          try {
            const { saleDate, soldTo, quantitySold, form } = sale;

            // Validate sale date
            let formattedSaleDate;
            if (saleDate.includes("/")) {
              const [day, month, year] = saleDate.split("/");
              formattedSaleDate = `${year}-${month.padStart(
                2,
                "0"
              )}-${day.padStart(2, "0")}`;
            } else if (saleDate.includes("-")) {
              const parts = saleDate.split("-");
              if (parts.length === 3) {
                // Check if it's dd-MM-yyyy or yyyy-MM-dd format
                if (parts[0].length === 4) {
                  // yyyy-MM-dd format
                  formattedSaleDate = saleDate;
                } else {
                  // dd-MM-yyyy format
                  const [day, month, year] = parts;
                  formattedSaleDate = `${year}-${month.padStart(
                    2,
                    "0"
                  )}-${day.padStart(2, "0")}`;
                }
              } else {
                formattedSaleDate = saleDate;
              }
            } else {
              formattedSaleDate = saleDate;
            }
            const quantityNum = parseFloat(quantitySold);
            if (isNaN(quantityNum) || quantityNum <= 0) {
              importResults.errors.push(
                `Item ${sno}: Invalid sale quantity "${quantitySold}"`
              );
              continue;
            }

            // Check if this sale would exceed the item weight
            cumulativeSalesQuantity += quantityNum;
            if (cumulativeSalesQuantity > weightNum) {
              importResults.errors.push(
                `Item ${sno}: Cumulative sales quantity ${cumulativeSalesQuantity} exceeds item weight ${weightNum}`
              );
              continue;
            }
            // Check if this exact sale already exists (for new inventory items, this should be rare) - need to decrypt to compare
            const existingSales = await database.select(
              "SELECT id, sold_to, quantity_sold FROM sales WHERE inventory_id = ? AND sale_date = ? AND form = ?",
              [inventoryId, formattedSaleDate, form || null]
            );

            let isDuplicateSale = false;
            for (const existingSale of existingSales) {
              const decryptedSale = await decryptSalesData(existingSale);
              if (
                decryptedSale.sold_to === soldTo &&
                parseFloat(decryptedSale.quantity_sold) === quantityNum
              ) {
                isDuplicateSale = true;
                break;
              }
            }

            if (!isDuplicateSale) {
              // Encrypt sales data before storing
              const newSalesData = {
                sold_to: soldTo,
                quantity_sold: quantityNum,
                dimensions: dimensionsJson,
              };
              const encryptedNewSalesData = await encryptSalesData(
                newSalesData
              );

              await database.execute(
                `INSERT INTO sales (inventory_id, sale_date, sold_to, quantity_sold, form, dimensions)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  inventoryId,
                  formattedSaleDate,
                  encryptedNewSalesData.sold_to,
                  encryptedNewSalesData.quantity_sold,
                  form || null,
                  encryptedNewSalesData.dimensions,
                ]
              );

              importResults.salesImported++;
            } else {
              importResults.errors.push(
                `Item ${sno}: Duplicate sale found for ${formattedSaleDate} to ${soldTo}`
              );
            }
          } catch (error) {
            importResults.errors.push(`Item ${sno} sale: ${error.message}`);
          }
        }

        importResults.success++;
      } catch (error) {
        importResults.errors.push(`Item ${sno}: ${error.message}`);
      }
    }

    return importResults;
  } catch (error) {
    console.error("Error importing combined CSV:", error);
    throw error;
  }
}

// Database backup and restore functions
export async function createDatabaseBackup() {
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");

    // Get current database path
    const currentExe = await invoke("get_current_exe_path");
    const exeDir = await dirname(currentExe);
    const currentDbPath = await join(exeDir, "data", "steel_track.db");

    // Open save dialog
    const backupPath = await save({
      defaultPath: `backup_steel_track_${new Date()
        .toISOString()
        .split("T")[0]
        .replace(/-/g, "")}.db`,
      filters: [
        {
          name: "Database Files",
          extensions: ["db", "sqlite", "sqlite3"],
        },
      ],
    });

    if (backupPath) {
      // Copy current database to backup location
      await copyFile(currentDbPath, backupPath);
      console.log(`Database backed up to: ${backupPath}`);
      return backupPath;
    }

    return null;
  } catch (error) {
    console.error("Error creating database backup:", error);
    throw error;
  }
}

export async function loadDatabaseFromFile() {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");

    // Open file dialog to select database
    const selectedFile = await open({
      filters: [
        {
          name: "Database Files",
          extensions: ["db", "sqlite", "sqlite3"],
        },
      ],
    });

    if (selectedFile) {
      // Get current database path
      const currentExe = await invoke("get_current_exe_path");
      const exeDir = await dirname(currentExe);
      const currentDbPath = await join(exeDir, "data", "steel_track.db");

      // Verify the selected file exists
      if (!(await exists(selectedFile))) {
        throw new Error("Selected database file does not exist");
      }

      // Close current database connection
      if (db) {
        await db.close();
        db = null;
      }

      // Create backup of current database before replacing
      try {
        const backupPath = await join(
          exeDir,
          "data",
          `steel_track_backup_${Date.now()}.db`
        );
        if (await exists(currentDbPath)) {
          await copyFile(currentDbPath, backupPath);
          console.log(`Current database backed up to: ${backupPath}`);
        }
      } catch (backupError) {
        console.warn("Failed to create automatic backup:", backupError);
      }

      // Copy selected file to current database location
      await copyFile(selectedFile, currentDbPath);

      // Reinitialize database with new file
      db = await Database.load(`sqlite:${currentDbPath}`);

      // Verify database structure and create missing tables if needed
      await createTables();

      console.log(`Database loaded from: ${selectedFile}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error loading database from file:", error);
    throw error;
  }
}

export async function getCurrentDatabaseInfo() {
  try {
    const currentExe = await invoke("get_current_exe_path");
    const exeDir = await dirname(currentExe);
    const currentDbPath = await join(exeDir, "data", "steel_track.db");

    if (await exists(currentDbPath)) {
      const meta = await metadata(currentDbPath);
      return {
        path: currentDbPath,
        size: meta.size,
        modified: meta.modifiedAt,
      };
    }

    return null;
  } catch (error) {
    console.error("Error getting database info:", error);
    return null;
  }
}
