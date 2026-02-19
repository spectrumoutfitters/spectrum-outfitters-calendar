import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'os'
import selfsigned from 'selfsigned'

// Get first non-internal IPv4 so the cert matches when phone connects via http://<IP>:5173
function getLocalIP() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) return n.address
    }
  }
  return null
}

export default defineConfig(async () => {
  const localIP = getLocalIP()
  const attrs = [{ name: 'commonName', value: 'localhost' }]
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' }
  ]
  if (localIP) altNames.push({ type: 7, ip: localIP })

  const pems = await selfsigned.generate(attrs, {
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      { name: 'subjectAltName', altNames }
    ]
  })

  // When deployed under a subpath (e.g. spectrumoutfitters.com/so-app), set VITE_BASE_PATH=/so-app
  const basePath = (process.env.VITE_BASE_PATH || '').replace(/\/+$/, '');
  const base = basePath ? `${basePath}/` : '/';

  return {
    base,
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      https: { key: pems.private, cert: pems.cert },
      strictPort: false,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
          configure: (proxy) => {
            proxy.on('error', (err) => console.error('Proxy error:', err))
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Host', 'localhost:5000')
            })
            proxy.on('proxyRes', (proxyRes, req) => {
              if (proxyRes.statusCode >= 400) {
                console.log(`Proxy response: ${req.method} ${req.url} -> ${proxyRes.statusCode}`)
              }
            })
          }
        },
        '/socket.io': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err) => console.error('Socket proxy error:', err))
          }
        },
        '/downloads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err) => console.error('Downloads proxy error:', err))
          }
        },
        '/payroll-system': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err) => console.error('Payroll system proxy error:', err))
          }
        }
      }
    }
  }
})
