// Node.js-compatible Database Encryption Setup Script
// This script helps set up the encrypted database functionality using Node.js sqlite3

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Test access code
const testAccessCode = 'ST#Pass';

// Hash function compatible with the auth.js implementation
async function hashCode(code) {
  const hash = crypto.createHash('sha256');
  hash.update(code);
  return hash.digest('hex');
}

// Simple encryption/decryption using the access code
async function encryptData(data, accessCode) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Create a key from the access code
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(accessCode.padEnd(32, '0')), // Pad to 32 bytes
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(data)
  );
  
  // Combine salt, iv, and encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedData, accessCode) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  try {
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    // Recreate the key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(accessCode.padEnd(32, '0')),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

// Encrypt sensitive fields
async function encryptInventoryItem(item, accessCode) {
  if (!accessCode) return item;
    const encryptedItem = { ...item };
    // Encrypt sensitive fields
  const sensitiveFields = ['sno', 'type', 'weight', 'coating', 'specifications', 'form', 'lot', 'sold_to'];
  
  for (const field of sensitiveFields) {
    if (item[field] !== null && item[field] !== undefined) {
      encryptedItem[field] = await encryptData(String(item[field]), accessCode);
    }
  }
  
  return encryptedItem;
}

// Decrypt sensitive fields
async function decryptInventoryItem(item, accessCode) {
  if (!accessCode) return item;
    const decryptedItem = { ...item };
    // Decrypt sensitive fields
  const sensitiveFields = ['sno', 'type', 'weight', 'coating', 'specifications', 'form', 'lot', 'sold_to'];
  
  for (const field of sensitiveFields) {
    if (item[field] !== null && item[field] !== undefined) {
      const decrypted = await decryptData(item[field], accessCode);
      if (decrypted !== null) {
        // Convert back to appropriate type
        if (field === 'weight') {
          decryptedItem[field] = parseFloat(decrypted);
        } else {
          decryptedItem[field] = decrypted;
        }
      }
    }
  }
  
  return decryptedItem;
}

async function setupEncryptedDatabase() {
  try {
    console.log('🔧 Setting up encrypted database...');
    
    // Create data directory in debug folder if it doesn't exist
    const dataDir = path.join(process.cwd(), 'src-tauri', 'target', 'debug', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('Created data directory in debug folder');
    }

    // Open database
    const dbPath = path.join(dataDir, 'st_detail.db');
    console.log('Opening database at:', dbPath);
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('Database opened successfully');
    
    // Create tables if they don't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS auth_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_hash TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);    await db.exec(`
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
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_dimensions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_id INTEGER NOT NULL,
        thickness REAL NOT NULL,
        width INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
      )
    `);    await db.exec(`
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
    `);

    console.log('All tables created successfully');

    // Hash and store the access code
    console.log('Hashing access code...');
    const hashedCode = await hashCode(testAccessCode);
    
    // Check if code already exists
    const existing = await db.get('SELECT id FROM auth_codes WHERE code_hash = ?', [hashedCode]);
    
    if (existing) {
      console.log('Access code already exists in database');
    } else {
      await db.run('INSERT INTO auth_codes (code_hash) VALUES (?)', [hashedCode]);
      console.log('✅ Access code stored successfully!');
    }

    return { db, dbPath };
  } catch (error) {
    console.error('Error setting up encrypted database:', error);
    throw error;
  }
}



async function migrateExistingDatabase(db) {
  console.log('📦 Migrating existing database to encrypted format...');
  
  try {
    // Get all existing inventory items
    const existingItems = await db.all('SELECT * FROM inventory');
    
    if (existingItems.length === 0) {
      console.log('📭 No existing data to migrate');
      return { migrated: 0, message: 'No data to migrate' };
    }

    console.log(`📊 Found ${existingItems.length} items to migrate`);

    let migratedCount = 0;

    for (const item of existingItems) {
      try {
        // Check if item is already encrypted (try to decrypt)
        const testDecrypt = await decryptData(item.sno, testAccessCode);
        
        if (testDecrypt === null) {
          // Item is not encrypted, encrypt it
          const encryptedItem = await encryptInventoryItem(item, testAccessCode);          // Update the item in database
          await db.run(`
            UPDATE inventory 
            SET sno = ?, type = ?, weight = ?, coating = ?, specifications = ?, form = ?, lot = ?, sold_to = ?
            WHERE id = ?
          `, [
            encryptedItem.sno,
            encryptedItem.type,
            encryptedItem.weight,
            encryptedItem.coating,
            encryptedItem.specifications,
            encryptedItem.form,
            encryptedItem.lot,
            encryptedItem.sold_to,
            item.id
          ]);
          
          migratedCount++;
        }
      } catch (error) {
        console.warn(`Warning: Could not migrate item ID ${item.id}:`, error.message);
      }
    }

    const result = {
      migrated: migratedCount,
      total: existingItems.length,
      message: `Successfully migrated ${migratedCount} out of ${existingItems.length} items`
    };

    console.log('✅ Migration completed:', result.message);
    return result;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function isDatabaseEncrypted(db) {
  try {
    // Check if there are any items in the database
    const item = await db.get('SELECT * FROM inventory LIMIT 1');
    
    if (!item) {
      return false; // No data to check
    }

    // Try to decrypt a field - if it fails, data is not encrypted
    try {
      const decrypted = await decryptData(item.sno, testAccessCode);
      return decrypted !== null;
    } catch (error) {
      return false; // Not encrypted
    }
  } catch (error) {
    console.error('Error checking encryption status:', error);
    return false;
  }
}

async function setupEncryption() {
  console.log('🔐 Database Encryption Setup (Node.js)');
  console.log('============================');
  
  try {
    // Setup encrypted database
    const { db, dbPath } = await setupEncryptedDatabase();
    console.log('✅ Database setup completed');
    
    // Test if database is encrypted
    const isEncrypted = await isDatabaseEncrypted(db);
    console.log(`🔍 Database encryption status: ${isEncrypted ? 'ENCRYPTED' : 'NOT ENCRYPTED'} (Ignore if the database is empty)`);
    
    console.log('🎉 Encryption setup completed successfully!');
    console.log(`📁 Database location: ${dbPath}`);
    
    await db.close();
    
  } catch (error) {
    console.error('❌ Error during setup:', error);
  }
}

async function migrateExistingData() {
  console.log('📦 Migrating existing database to encrypted format...');
  
  try {
    const dbPath = path.join(process.cwd(), 'src-tauri', 'target', 'debug', 'data', 'st_detail.db');
    
    if (!fs.existsSync(dbPath)) {
      console.log('❌ Database does not exist. Please run setup first.');
      return;
    }

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    const result = await migrateExistingDatabase(db);
    console.log('✅ Migration completed:', result);
    
    await db.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--migrate')) {
    await migrateExistingData();
  } else {
    await setupEncryption();
  }
}

// Run the script
main().catch(console.error);
