# Use login.spectrumoutfitters.com (no /login path)

Run this **on the server** (SSH: `ssh root@165.245.137.192`) so the app is at **login.spectrumoutfitters.com** and **165.245.137.192** with no `/login` in the URL.

**Step 1 – Set BASE_PATH to empty on the server**

```bash
sed -i 's/^BASE_PATH=.*/BASE_PATH=/' /var/www/spectrum-outfitters/backend/.env
```

**Step 2 – Update nginx to proxy / to Node (app at root)**

```bash
cat > /etc/nginx/sites-available/spectrum-outfitters << 'EOF'
server {
    listen 80;
    server_name login.spectrumoutfitters.com 165.245.137.192;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF
nginx -t && systemctl reload nginx
```

**Step 3 – Restart the app**

```bash
pm2 restart spectrum-outfitters
```

Then use: **http://login.spectrumoutfitters.com** (login page is at .../login when not logged in).
