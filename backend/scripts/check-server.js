import http from 'http';

const BACKEND_URL = 'http://localhost:5000';
const API_HEALTH = `${BACKEND_URL}/api/health`;

console.log('🔍 Checking if backend server is running...\n');

const checkBackend = () => {
  return new Promise((resolve, reject) => {
    const req = http.get(API_HEALTH, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            resolve({ status: 'ok' });
          }
        } else {
          reject(new Error(`Server returned status ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Connection timeout - server not responding'));
    });
  });
};

checkBackend()
  .then((result) => {
    console.log('✅ Backend server is running!');
    console.log(`   URL: ${BACKEND_URL}`);
    console.log(`   Status: ${result.status || 'ok'}`);
    console.log(`   Timestamp: ${result.timestamp || 'N/A'}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backend server is NOT running!');
    console.error(`   Error: ${error.message}`);
    console.error('\n💡 To start the backend:');
    console.error('   Run: npm run dev');
    console.error('\n   Common issues:');
    console.error('   - JWT_SECRET not set in .env file');
    console.error('   - Database not initialized (run: npm run init-db)');
    console.error('   - Port 5000 already in use');
    console.error('   - Missing dependencies (run: npm install)');
    process.exit(1);
  });

