import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path - adjust if your database is in a different location
const dbPath = path.join(__dirname, 'src-tauri', 'target', 'debug', 'data' ,'st_detail.db');

// Sample data arrays
const types = ['E', 'GA', 'GA1', '4', '5', '4N', '4G'];
const qualities = ['Soft', 'Hard', 'Semi'];
const companies = [
  'ABC Steel Ltd',
  'Metro Industries',
  'Prime Steel Co',
  'Steel Masters',
  'Industrial Corp',
  'Heavy Metals Inc',
  'Steel Solutions',
  'Iron Works Ltd',
  '',
  '',
  '' // Some empty values for unsold items
];

// Function to generate random date within last 6 months
function getRandomDate() {
  const start = new Date();
  start.setMonth(start.getMonth() - 6);
  const end = new Date();
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime).toISOString().split('T')[0];
}

// Function to generate random number in range
function randomBetween(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

// Function to generate random integer in range
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate sample data
function generateSampleData() {
  const data = [];
  const lotPrefixes = ['LOT-A', 'LOT-B', 'LOT-C', 'LOT-D', 'LOT-E'];
  
  for (let i = 1; i <= 25; i++) {
    const entry = {
      entry_date: getRandomDate(),
      sno: i.toString(),
      type: types[Math.floor(Math.random() * types.length)],
      thickness: randomBetween(0.5, 5.0),
      width: randomBetween(50, 200),
      weight: randomBetween(100, 1000),
      lot: `${lotPrefixes[Math.floor(Math.random() * lotPrefixes.length)]}-${randomInt(100, 999)}`,
      quality: qualities[Math.floor(Math.random() * qualities.length)],
      sold_to: companies[Math.floor(Math.random() * companies.length)],
      completed: Math.random() > 0.7 ? 1 : 0 // 30% chance of being completed
    };
    data.push(entry);
  }
  
  return data;
}

// Main function to populate database
async function populateDatabase() {
  try {
    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      console.error(`Database not found at: ${dbPath}`);
      console.log('Please make sure your Tauri app has been run at least once to create the database.');
      console.log('You can also check if the database is in a different location like:');
      console.log('- data/st_detail.db');
      console.log('- src-tauri/target/debug/st_detail.db');
      return;
    }

    console.log(`Connecting to database at: ${dbPath}`);
    
    const db = new (sqlite3.verbose()).Database(dbPath);
    const sampleData = generateSampleData();
    
    console.log('Generated 25 sample entries. Inserting into database...');
    
    // Prepare insert statement
    const insertStmt = db.prepare(`
      INSERT INTO inventory (entry_date, sno, type, thickness, width, weight, lot, quality, sold_to, completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Insert all sample data
    for (const entry of sampleData) {
      insertStmt.run([
        entry.entry_date,
        entry.sno,
        entry.type,
        parseFloat(entry.thickness),
        parseFloat(entry.width),
        parseFloat(entry.weight),
        entry.lot,
        entry.quality,
        entry.sold_to || null,
        entry.completed
      ]);
    }
    
    insertStmt.finalize();
    
    // Verify insertion
    db.get('SELECT COUNT(*) as count FROM inventory', (err, row) => {
      if (err) {
        console.error('Error counting records:', err);
      } else {
        console.log(`✅ Successfully populated database! Total records: ${row.count}`);
      }
      
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed.');
          console.log('\n🎉 Sample data added successfully!');
          console.log('You can now run your Tauri app to see the populated inventory.');
        }
      });
    });
    
  } catch (error) {
    console.error('Error populating database:', error);
  }
}

// Check if sqlite3 module is available
try {
  populateDatabase();
} catch (e) {
  console.error('sqlite3 module not found. Please install it first:');
  console.log('npm install sqlite3');
  console.log('\nThen run: node populate.js');
}
