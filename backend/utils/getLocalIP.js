import { networkInterfaces } from 'os';

export function getLocalIP() {
  const interfaces = networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  
  // Return the first non-localhost IP, or localhost if none found
  return addresses[0] || 'localhost';
}

