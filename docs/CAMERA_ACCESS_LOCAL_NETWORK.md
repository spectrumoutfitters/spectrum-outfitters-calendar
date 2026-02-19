# Camera Access on Local Network (Without HTTPS)

## The Challenge
Browsers require HTTPS (or localhost) for camera access due to security policies. On a local network using HTTP, camera access is blocked.

## Solution: Smart Camera/Upload Detection

The app now automatically detects your access method and provides the best option:

### ✅ Camera Works On:
- **localhost** (even with HTTP) - `http://localhost:5173`
- **HTTPS** (any hostname) - `https://192.168.1.100:5173`

### 📸 File Upload Works On:
- **Network IP with HTTP** - `http://192.168.1.100:5173`
- Automatically shows file upload option instead of camera

## How It Works

1. **On localhost (HTTP):**
   - Camera access works! ✅
   - Full camera functionality available

2. **On network IP (HTTP):**
   - Camera is blocked by browser
   - App automatically shows file upload option
   - Users can take photo with phone camera and upload it

3. **On HTTPS (any hostname):**
   - Camera access works! ✅
   - Full camera functionality available

## User Experience

### When Checking Out:
- **localhost users:** See camera interface
- **Network IP users:** See file upload prompt (can use phone camera)
- **HTTPS users:** See camera interface

### File Upload Option:
- Works on all devices
- Opens device camera when available
- Allows selecting existing photos
- Same end result (photo attached to order)

## Best Practice for Your Setup

Since you're on a local network:

1. **For main computer:** Use `http://localhost:5173`
   - Full camera access
   - Best experience

2. **For other devices:** Use `http://192.168.1.100:5173`
   - File upload works perfectly
   - Can use phone camera to take photo
   - Then upload it

3. **Alternative:** Enable HTTPS (see below)

## To Enable HTTPS (Optional)

If you want camera access from network devices:

1. Edit `frontend/vite.config.js`
2. Change `https: false` to `https: true`
3. Restart frontend
4. Access via `https://192.168.1.100:5173`
5. Accept security warning (normal for self-signed cert)
6. Camera will work!

## Why This Works

- **localhost exception:** Browsers allow camera on localhost even with HTTP
- **File upload fallback:** Works everywhere, can use device camera
- **Smart detection:** App automatically chooses the best option

This gives you the best of both worlds - camera access where possible, file upload everywhere else!

