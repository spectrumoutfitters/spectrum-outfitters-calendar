# Network Access Guide

The application is now configured to be accessible from other devices on the same WiFi network.

## 🌐 How to Access from Other Devices

### Step 1: Start the Application

Start the application using the launcher or scripts as usual.

### Step 2: Find Your Computer's IP Address

When the backend starts, it will display your network IP address in the console:

```
🌐 Access the application from:
   Local:    http://localhost:5173
   Network:  http://192.168.1.100:5173

📱 To access from other devices on the same WiFi:
   Use: http://192.168.1.100:5173
```

**Note:** The IP address shown (e.g., `192.168.1.100`) is your computer's local network IP.

### Step 3: Access from Other Devices

On any device connected to the **same WiFi network**:

1. **Phone/Tablet:**
   - Open your mobile browser
   - Enter: `http://192.168.1.100:5173` (use the IP shown in the console)
   - The application will load

2. **Another Computer/Laptop:**
   - Open a web browser
   - Enter: `http://192.168.1.100:5173` (use the IP shown in the console)
   - The application will load

## 🔍 Finding Your IP Address Manually

If you need to find your IP address manually:

### Windows:
```cmd
ipconfig
```
Look for "IPv4 Address" under your WiFi adapter (usually starts with 192.168.x.x or 10.x.x.x)

### Mac/Linux:
```bash
ifconfig
```
or
```bash
ip addr show
```
Look for your WiFi adapter's inet address (usually starts with 192.168.x.x or 10.x.x.x)

## ⚠️ Important Notes

1. **Same WiFi Network Required:** All devices must be on the same WiFi network
2. **Firewall:** Make sure Windows Firewall allows connections on ports 5000 and 5173
3. **Dynamic IP:** Your IP address may change if you disconnect/reconnect to WiFi
4. **Security:** This is for local network access only. The application is not exposed to the internet

## 🔥 Firewall Configuration

### Windows Firewall

If you can't access from other devices, you may need to allow the ports:

1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. Select "TCP" and enter ports: `5000, 5173`
6. Allow the connection
7. Apply to all profiles
8. Name it "Spectrum Outfitters"

Or run PowerShell as Administrator:
```powershell
New-NetFirewallRule -DisplayName "Spectrum Outfitters" -Direction Inbound -LocalPort 5000,5173 -Protocol TCP -Action Allow
```

## 📱 Mobile Access Tips

- **Bookmark the URL** on your phone for quick access
- **Add to Home Screen** (iOS/Android) for app-like experience
- The application is mobile-responsive and works great on tablets

## 🐛 Troubleshooting

### Can't access from other devices?

1. **Check IP Address:** Make sure you're using the correct IP from the console
2. **Check WiFi:** Ensure all devices are on the same network
3. **Check Firewall:** Windows Firewall may be blocking connections
4. **Check Ports:** Verify ports 5000 and 5173 are not blocked
5. **Try ping:** From another device, try: `ping 192.168.1.100` (your IP)

### Connection refused?

- Make sure the backend server is running
- Check that the IP address hasn't changed
- Verify firewall settings

### CORS errors?

- The application is configured to allow local network access
- If you see CORS errors, check the backend console for allowed origins

## 🔒 Security Note

This configuration allows access from your local network only. The application is **not** exposed to the internet. Only devices on your WiFi network can access it.

For production deployment with internet access, you would need:
- A domain name
- SSL certificate (HTTPS)
- Proper security configuration
- Reverse proxy (nginx, etc.)

