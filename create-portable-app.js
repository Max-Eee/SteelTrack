import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('📦 Creating portable app package...');

// Define paths
const releasePath = path.join(__dirname, 'src-tauri', 'target', 'release');
const portablePath = path.join(__dirname, 'portable-app');
const exePath = path.join(releasePath, 'st-detail.exe');
const dataPath = path.join(releasePath, 'data');

// Function to copy directory recursively
function copyDirectory(src, dest) {
    if (!fs.existsSync(src)) {
        console.log(`❌ Source directory does not exist: ${src}`);
        return false;
    }

    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
    return true;
}

// Function to copy file
function copyFile(src, dest) {
    if (!fs.existsSync(src)) {
        console.log(`❌ Source file does not exist: ${src}`);
        return false;
    }
    
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.copyFileSync(src, dest);
    return true;
}

try {
    // Remove existing portable app folder if it exists
    if (fs.existsSync(portablePath)) {
        console.log('🗑️ Removing existing portable-app folder...');
        fs.rmSync(portablePath, { recursive: true, force: true });
    }

    // Create portable app directory
    console.log('📁 Creating portable-app directory...');
    fs.mkdirSync(portablePath, { recursive: true });

    // Check if executable exists
    if (!fs.existsSync(exePath)) {
        console.log('❌ st-detail.exe not found in release directory');
        console.log('   Make sure you have run "npm run tauri:build" first');
        process.exit(1);
    }

    // Copy executable
    console.log('📋 Copying st-detail.exe...');
    const destExePath = path.join(portablePath, 'st-detail.exe');
    if (copyFile(exePath, destExePath)) {
        console.log('✅ st-detail.exe copied successfully');
    } else {
        throw new Error('Failed to copy executable');
    }

    // Copy data folder
    console.log('📋 Copying data folder...');
    const destDataPath = path.join(portablePath, 'data');
    if (copyDirectory(dataPath, destDataPath)) {
        console.log('✅ Data folder copied successfully');
    } else {
        throw new Error('Failed to copy data folder');
    }

    // Create a simple README for the portable app
    const readmeContent = `ST Detail - Portable App
========================

This is a portable version of ST Detail application.

Files included:
- st-detail.exe: The main application executable
- data/: Database and application data folder

Instructions:
1. Keep the st-detail.exe and data folder in the same directory
2. Double-click st-detail.exe to run the application
3. The application will automatically find the database in the data folder

For support or updates, refer to the main project repository.

Generated on: ${new Date().toLocaleString()}
`;

    fs.writeFileSync(path.join(portablePath, 'README.txt'), readmeContent);
    console.log('✅ README.txt created');

    // Display summary
    console.log('\n🎉 Portable app package created successfully!');
    console.log(`📁 Location: ${portablePath}`);
    console.log('\n📋 Contents:');
    console.log('   ├── st-detail.exe');
    console.log('   ├── data/');
    console.log('   │   └── st_detail.db (and other data files)');
    console.log('   └── README.txt');
    console.log('\n🚀 The portable app is ready for distribution!');

} catch (error) {
    console.error('❌ Error creating portable app package:', error.message);
    process.exit(1);
}
