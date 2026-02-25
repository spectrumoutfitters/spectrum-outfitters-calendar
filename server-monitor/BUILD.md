# Building Spectrum Server Monitor into an application

This produces a **Windows installer** (`.exe`) so you can install and run the app like any other program.

## 1. Add your logos (recommended)

Before building, add your Spectrum Outfitters branding so the app and installer use your logo:

1. Open the **`server-monitor/assets/`** folder.
2. Copy your **Spectrum Outfitters Emblem** (gold S + mountains in a circle) into that folder and name it **`icon.png`**.
   - Use 256×256 or 512×512 pixels so the taskbar and installer icon stay sharp.
3. See **`server-monitor/assets/README.md`** for optional full logo and where to get the files.

If you skip this step, the app still builds and runs but will show the default Electron icon and text-only branding in the sidebar.

## 2. Install dependencies (if you haven’t already)

From the **`server-monitor`** folder:

```bash
npm install
```

## 3. Build the Windows application

From the **`server-monitor`** folder run:

```bash
npm run build
```

This uses **electron-builder** to create a Windows installer.

## 4. Where to find the built app

After the build finishes:

- **Installer:** `server-monitor/dist/Spectrum Server Monitor Setup 1.0.0.exe` (or similar).
- Run the installer to install the app; then start **Spectrum Server Monitor** from the Start menu or desktop shortcut.

The app will use your **`assets/icon.png`** for:

- The window/taskbar icon
- The sidebar logo
- The installer and .exe icon (when you added `icon.png` before building)

## Troubleshooting

- **Build fails:** Make sure you’re in the `server-monitor` directory and you’ve run `npm install`.
- **Icon not showing in installer:** Add `assets/icon.png` (256×256 or 512×512) and run `npm run build` again.
- **Sidebar or window icon missing:** Copy your emblem as `server-monitor/assets/icon.png` and restart the app (or rebuild if you’re using the installed .exe).
