# Spectrum Server Monitor – logo assets

Put your **Spectrum Outfitters** logo files here so the app and the built .exe use your branding.

## Required

- **`icon.png`** — Use the **Spectrum Outfitters Emblem** (gold S + mountains in a circle).  
  Used for:
  - The **window icon** (taskbar and title bar)
  - The **sidebar** logo
  - The **installer and .exe icon** when you run `npm run build`  
  **Size:** 256×256 px or 512×512 px recommended so the taskbar and installer icon stay sharp.

## Optional

- **`logo.png`** — Use the **Spectrum Outfitters full logo** (wordmark + tagline).  
  Can be used in the UI (e.g. header or About) if you add a spot for it.

## Where to get the files

Use the same assets as the main Spectrum Outfitters app:

- **Emblem / icon:** `Spectrum_Outfitters_Emblem_Icon` or `Spectrum_Apparel_ICON_PNG`
- **Full logo:** `Spectrum_Outfitters_Full_Logo_PNG`

Copy them into this `server-monitor/assets/` folder as `icon.png` and (optionally) `logo.png`, then run or build the app.

If these files are missing, the app still runs but shows the text “Spectrum Server Monitor” in the sidebar and the default Electron icon in the taskbar.
