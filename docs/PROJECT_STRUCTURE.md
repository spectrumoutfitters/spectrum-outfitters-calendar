# Project Structure

This document describes the organization of the Spectrum Outfitters application.

## Directory Structure

```
spectrum-outfitters/
├── backend/                 # Backend API server
│   ├── database/           # Database files and migrations
│   ├── middleware/         # Express middleware
│   ├── routes/            # API route handlers
│   ├── utils/            # Utility functions
│   ├── server.js         # Main server file
│   └── package.json      # Backend dependencies
│
├── frontend/              # Frontend React application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts (Auth, Socket)
│   │   ├── pages/        # Page components
│   │   └── utils/        # Utility functions
│   ├── index.html        # HTML entry point
│   └── package.json      # Frontend dependencies
│
├── launcher/              # Desktop launcher application
│   ├── launcher.js       # Launcher server code
│   ├── package.json      # Launcher dependencies
│   └── start-launcher.bat # Windows launcher shortcut
│
├── scripts/               # Startup/shutdown scripts
│   ├── start.bat         # Windows start script
│   ├── start.js          # Cross-platform start script
│   ├── start.ps1         # PowerShell start script
│   ├── stop.bat          # Windows stop script
│   └── stop.ps1          # PowerShell stop script
│
├── docs/                  # Documentation files
│   ├── README.md         # Main documentation
│   ├── SETUP.md          # Setup instructions
│   ├── TROUBLESHOOTING.md # Troubleshooting guide
│   └── PROJECT_STRUCTURE.md # This file
│
├── START_APPLICATION.bat  # Desktop shortcut (double-click to start)
├── README.md              # Main README
└── package.json          # Root package.json
```

## Key Files

### Startup Files
- **`START_APPLICATION.bat`** - Main desktop shortcut (double-click to start)
- **`launcher/start-launcher.bat`** - Launcher startup script
- **`START_APPLICATION.bat`** - One-click startup script (Windows) - starts backend, frontend, and monitor

### Configuration Files
- **`backend/.env`** - Backend environment variables (JWT_SECRET, etc.)
- **`backend/database/shop_tasks.db`** - SQLite database file

### Documentation
- **`README.md`** - Main project documentation
- **`docs/`** - All detailed documentation files

## How to Use

### Quick Start (Recommended)
1. Double-click `START_APPLICATION.bat`
2. Launcher web interface opens in browser
3. Click "Start Application" button
4. Application opens automatically

### Manual Start
1. Run `START_APPLICATION.bat` (Windows) in the root directory
2. Two terminal windows open (backend and frontend)
3. Browser opens automatically to http://localhost:5173

### Stop Application
- **Launcher**: Click "Stop Application" in launcher interface
- **Manual**: Close terminal windows manually

## Ports Used

- **3001** - Launcher web interface
- **5000** - Backend API server
- **5173** - Frontend development server

Make sure these ports are available before starting.

