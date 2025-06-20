#!/usr/bin/env node

/**
 * Production Setup Script for SteelTrack App
 * 
 * This script helps set up the correct folder structure for production deployment,
 * especially for portable installations (like on a pendrive).
 * 
 * Expected structure after build:
 * src-tauri/target/release/
 * ├── steel-track.exe (or your app executable)
 * └── data/
 *     └── st_detail.db
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function setupProductionStructure() {
  console.log('🚀 Setting up production folder structure...');
  
  // First, run the encryption setup
  console.log('🔐 Running setup...');
  try {
    execSync('node setup-encryption-nodejs.js', { stdio: 'inherit' });
    console.log('✅Setup completed');
  } catch (error) {
    console.error('❌ Error running setup:', error.message);
    // Continue with the rest of the setup even if encryption fails
  }  
  // Paths - Updated to copy from debug to release
  const projectRoot = __dirname;
  const dataSourcePath = path.join(projectRoot, 'src-tauri', 'target', 'debug', 'data');
  const releaseDataPath = path.join(projectRoot, 'src-tauri', 'target', 'release', 'data');
  
  try {
    // Check if source data folder exists
    if (!fs.existsSync(dataSourcePath)) {
      console.error('❌ Source data folder not found at:', dataSourcePath);
      console.log('Please ensure the encryption setup has been run first to create the debug data folder');
      return false;
    }
      // Create release data folder if it doesn't exist
    if (!fs.existsSync(releaseDataPath)) {
      fs.mkdirSync(releaseDataPath, { recursive: true });
      console.log('✅ Created data folder in release directory');
    }
    
    // Copy entire data folder contents from debug to release
    const files = fs.readdirSync(dataSourcePath);
    let copiedFiles = 0;
    
    for (const file of files) {
      const sourcePath = path.join(dataSourcePath, file);
      const targetPath = path.join(releaseDataPath, file);
      
      if (fs.statSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, targetPath);
        copiedFiles++;
        console.log(`✅ Copied ${file} to release data folder`);
      }
    }
    
    if (copiedFiles === 0) {
      console.log('⚠️  No files found in debug data folder, will be created on first run');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error setting up production structure:', error);
    return false;
  }
}

// Run the setup function
setupProductionStructure();

export { setupProductionStructure };
