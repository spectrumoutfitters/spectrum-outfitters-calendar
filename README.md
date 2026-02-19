# Spectrum Outfitters - Employee Task Management & Time Clock System

A full-stack web application for managing employee tasks and tracking time for payroll in an automotive shop environment.

## 🚀 Quick Start

### Desktop Launcher (Recommended)

**Windows:** Double-click `START_APPLICATION.bat` in the root directory

This will open a web-based launcher interface where you can:
- ✅ Start/Stop the application with one click
- ✅ View real-time status
- ✅ Access the application directly

### Manual Start

**Windows:** Double-click `START_APPLICATION.bat` in the root directory

## 📱 Network Access

The application is configured to be accessible from other devices on the same WiFi network!

**To access from your phone, tablet, or another computer:**
1. Start the application (backend will show your network IP address)
2. On your other device, open a browser and go to: `http://YOUR_IP:5173`
   - Example: `http://192.168.1.100:5173`
3. The application will load and work just like on your computer

**See `docs/NETWORK_ACCESS.md` for detailed instructions and troubleshooting.**

## 🌐 Deploying Online (spectrumoutfitters.com)

To make the app accessible from anywhere at a **secret URL** (e.g. **spectrumoutfitters.com/login**) while keeping the database on your server (or using a private Google Sheet), see **`docs/DEPLOYMENT.md`**. It covers base path setup, hosting options, and database choices.

## 📁 Project Structure

```
spectrum-outfitters/
├── backend/          # Express.js API server
├── frontend/         # React application
├── launcher/         # Desktop launcher application
├── scripts/          # Startup/shutdown scripts
├── docs/             # Documentation files
└── README.md         # This file
```

## ✨ Features

- **Multi-user Authentication**: Secure JWT-based authentication with role-based access (Admin/Employee)
- **Time Clock System**: Clock in/out functionality with break tracking and timesheet management
- **Kanban Task Board**: Drag-and-drop task management with status tracking
- **Task Management**: Create, assign, and track tasks with categories, priorities, and due dates
- **Live Messaging**: Team and private messaging with real-time notifications
- **Admin Panel**: User management, time approval, and payroll reports
- **Mobile Responsive**: Optimized for tablet use on shop floor

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js + Socket.io
- **Database**: SQLite
- **Frontend**: React + Vite
- **Styling**: Tailwind CSS
- **Authentication**: JWT + bcrypt
- **Drag & Drop**: @dnd-kit

## 📚 Documentation

All documentation files are located in the `docs/` folder:
- `README.md` - Main documentation (this file)
- `SETUP.md` - Detailed setup instructions
- `TROUBLESHOOTING.md` - Common issues and solutions

## 🛑 Stopping the Application

- **Desktop Launcher**: Click "Stop Application" button in the launcher interface
- **Manual**: Close the server windows manually, or create a STOP_ALL.bat script if needed

## 📝 Requirements

- Node.js (v18 or higher)
- npm (comes with Node.js)
- Modern web browser

## 🔧 Configuration

The application uses environment variables for configuration. See `backend/.env.example` for available options.

**Important:** Make sure `JWT_SECRET` is set in `backend/.env` before starting!

## 📞 Support

For issues or questions, check the `docs/TROUBLESHOOTING.md` file.
