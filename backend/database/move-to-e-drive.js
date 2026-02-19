import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const E_DRIVE_BASE = 'E:\\SpectrumOutfitters';
const E_DB_DIR = path.join(E_DRIVE_BASE, 'database');
const E_UPLOADS_DIR = path.join(E_DRIVE_BASE, 'uploads');

// Current paths
const CURRENT_DB = path.join(__dirname, 'shop_tasks.db');
const CURRENT_UPLOADS = path.join(__dirname, '..', 'uploads');

const moveToEDrive = async () => {
  try {
    console.log('🚀 Moving Spectrum Outfitters data to E: drive...\n');
    
    // 1. Create directories on E: drive
    console.log('📁 Creating directories on E: drive...');
    if (!fs.existsSync(E_DRIVE_BASE)) {
      fs.mkdirSync(E_DRIVE_BASE, { recursive: true });
      console.log(`   ✓ Created: ${E_DRIVE_BASE}`);
    }
    
    if (!fs.existsSync(E_DB_DIR)) {
      fs.mkdirSync(E_DB_DIR, { recursive: true });
      console.log(`   ✓ Created: ${E_DB_DIR}`);
    }
    
    if (!fs.existsSync(E_UPLOADS_DIR)) {
      fs.mkdirSync(E_UPLOADS_DIR, { recursive: true });
      console.log(`   ✓ Created: ${E_UPLOADS_DIR}`);
    }
    
    // 2. Move database
    const newDbPath = path.join(E_DB_DIR, 'shop_tasks.db');
    if (fs.existsSync(CURRENT_DB)) {
      console.log('\n💾 Moving database...');
      console.log(`   From: ${CURRENT_DB}`);
      console.log(`   To:   ${newDbPath}`);
      
      // Copy database file
      fs.copyFileSync(CURRENT_DB, newDbPath);
      console.log('   ✓ Database copied');
      
      // Verify the copy
      const originalSize = fs.statSync(CURRENT_DB).size;
      const newSize = fs.statSync(newDbPath).size;
      
      if (originalSize === newSize) {
        console.log('   ✓ Database copy verified');
        console.log(`   ⚠️  Original database still at: ${CURRENT_DB}`);
        console.log('   ⚠️  Delete it manually after verifying everything works');
      } else {
        throw new Error('Database copy size mismatch!');
      }
    } else {
      console.log('\n⚠️  Database not found at expected location, skipping...');
    }
    
    // 3. Move uploads directory
    if (fs.existsSync(CURRENT_UPLOADS)) {
      console.log('\n📸 Moving uploads directory...');
      console.log(`   From: ${CURRENT_UPLOADS}`);
      console.log(`   To:   ${E_UPLOADS_DIR}`);
      
      // Copy all files recursively
      const copyRecursive = (src, dest) => {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          
          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      
      copyRecursive(CURRENT_UPLOADS, E_UPLOADS_DIR);
      console.log('   ✓ Uploads copied');
      
      // Count files
      const countFiles = (dir) => {
        let count = 0;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            count += countFiles(path.join(dir, entry.name));
          } else {
            count++;
          }
        }
        return count;
      };
      
      const fileCount = countFiles(E_UPLOADS_DIR);
      console.log(`   ✓ Copied ${fileCount} files`);
      console.log(`   ⚠️  Original uploads still at: ${CURRENT_UPLOADS}`);
      console.log('   ⚠️  Delete it manually after verifying everything works');
    } else {
      console.log('\n⚠️  Uploads directory not found, creating empty structure...');
      fs.mkdirSync(path.join(E_UPLOADS_DIR, 'orders'), { recursive: true });
      fs.mkdirSync(path.join(E_UPLOADS_DIR, 'products'), { recursive: true });
    }
    
    // 4. Display configuration
    console.log('\n✅ Migration complete!\n');
    console.log('📝 Add these to your backend/.env file:\n');
    console.log(`DATABASE_PATH=${newDbPath.replace(/\\/g, '/')}`);
    console.log(`UPLOADS_PATH=${E_UPLOADS_DIR.replace(/\\/g, '/')}`);
    console.log('\n⚠️  After updating .env, restart your server!');
    console.log('⚠️  After verifying everything works, you can delete the old files.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    process.exit(1);
  }
};

moveToEDrive();

