# Enable HTTPS so the barcode scanner works

The inventory barcode scanner needs a **secure context** (HTTPS). Run these on the server once.

**1. SSH in**
```bash
ssh root@165.245.137.192
```

**2. Install Certbot**
```bash
apt install -y certbot python3-certbot-nginx
```

**3. Get a certificate for login.spectrumoutfitters.com**
```bash
certbot --nginx -d login.spectrumoutfitters.com --non-interactive --agree-tos -m YOUR_EMAIL@example.com
```
Replace `YOUR_EMAIL@example.com` with your real email (for expiry notices).

**4. Test**
- Open **https://login.spectrumoutfitters.com** (with **https**).
- Go to Inventory; the "Scan barcode" button should be enabled and the camera should work.

Certbot will auto-renew the certificate. After this, use **https://login.spectrumoutfitters.com** so the scanner works.
