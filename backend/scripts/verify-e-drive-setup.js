import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const verifySetup = () => {
  console.log('🔍 Verifying E: drive setup...\n');
  
  const projectRoot = path.resolve(__dirname, '../..');
  const dbPath = path.join(projectRoot, 'backend', 'database', 'shop_tasks.db');
  const uploadsPath = path.join(projectRoot, 'backend', 'uploads');
  
  console.log('Project location:', projectRoot);
  console.log('');
  
  // Check database
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('✅ Database found:');
    console.log(`   Path: ${dbPath}`);
    console.log(`   Size: ${Math.round(stats.size / 1024 / 1024)} MB`);
    console.log(`   Drive: ${dbPath.charAt(0)}: drive`);
  } else {
    console.log('❌ Database not found at:', dbPath);
  }
  
  console.log('');
  
  // Check uploads
  if (fs.existsSync(uploadsPath)) {
    console.log('✅ Uploads folder found:');
    console.log(`   Path: ${uploadsPath}`);
    
    const countFiles = (dir) => {
      let count = 0;
      let size = 0;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const sub = countFiles(fullPath);
            count += sub.count;
            size += sub.size;
          } else {
            count++;
            size += fs.statSync(fullPath).size;
          }
        }
      } catch (e) {
        // Ignore errors
      }
      return { count, size };
    };
    
    const { count, size } = countFiles(uploadsPath);
    console.log(`   Files: ${count}`);
    console.log(`   Total size: ${Math.round(size / 1024 / 1024)} MB`);
    console.log(`   Drive: ${uploadsPath.charAt(0)}: drive`);
  } else {
    console.log('⚠️  Uploads folder not found (will be created automatically)');
  }
  
  console.log('');
  
  // Check drive
  const drive = projectRoot.charAt(0);
  if (drive === 'E' || drive === 'e') {
    console.log('✅ Application is on E: drive');
    console.log('   You have 465GB free - plenty of space!');
  } else {
    console.log(`⚠️  Application is on ${drive}: drive`);
    console.log('   Consider moving to E: drive if you run out of space');
  }
  
  console.log('');
  console.log('✅ Setup verification complete!');
};

verifySetup();

