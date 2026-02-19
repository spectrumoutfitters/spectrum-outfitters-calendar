# Run this ONCE on the server (SSH) to enable http://YOUR_IP/login

SSH in: `ssh root@165.245.137.192`

Then run these commands one at a time (copy-paste the whole block is fine):

```bash
cat > /etc/nginx/sites-available/spectrum-outfitters << 'EOF'
server {
    listen 80;
    server_name 165.245.137.192;

    location /api {
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

    location /login {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads { proxy_pass http://127.0.0.1:5000; }
    location /downloads { proxy_pass http://127.0.0.1:5000; }
    location /payroll-system { proxy_pass http://127.0.0.1:5000; }
}
EOF

ln -sf /etc/nginx/sites-available/spectrum-outfitters /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

Then in your browser open: **http://165.245.137.192/login**

- Login page: **http://165.245.137.192/login/login**
- Default admin: username **admin**, password **SpectrumAdmin2024!** (change after first login)
