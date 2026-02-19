/**
 * Seed the February 2026 changelog into system_updates.
 * Idempotent — skips if version 2.1.0 already exists.
 */
import db from './db.js';

const VERSION = '2.1.0';

const TITLE = 'February 2026 Update — My List, Dashboard Overhaul & More';

const CONTENT = `## What's New

This is a major update to the Spectrum Outfitters app. Here's everything that changed and how to use it.

## My List — Personal Task Management (NEW)

**Where to find it:** Sidebar > "My List" (second item in navigation)

Your own personal daily work list. Every user — admin or employee — gets their own private task list to stay on track throughout the day.

### How to use it
- Type a task into the "Add a task" bar at the top and tap **Add**
- Check off tasks as you complete them — completed items move to the bottom
- Set a **Today's Focus** at the top to keep your main priority visible
- Tasks reset daily so you start fresh each morning
- Only you can see your list — it's private to your account

## Admin Work List — Rebuilt From Scratch

**Where to find it:** Admin > Work List tab

The admin work list has been completely rebuilt with a cleaner layout and much better functionality.

### What changed
- **Single checkbox** — one tap to complete (no more double checkmarks)
- **Selection mode** — tap "Select" to enable bulk complete or delete
- **Today's Focus** — set a focus message that stays visible at the top
- **Goals** — add long-term goals to track progress beyond daily tasks
- **Quick add** — add tasks instantly from the top bar
- **Suggestions** — toggle suggested tasks based on common shop operations
- **Completed items** — completed tasks collapse to the bottom with who completed them and when

### How to use it
1. Add tasks using the input at the top of the page
2. Tap the circle next to a task to mark it complete
3. Tap "Select" in the top-right to switch to bulk mode for multiple items
4. Scroll down to "Today's Focus" to type what the team should prioritize
5. Use the "Goals" section to add targets the team is working toward

## Dashboard — Complete Overhaul

**Where to find it:** Sidebar > "Dashboard" (first item, or tap the logo)

The dashboard is now a full command center for the business.

### Admin Dashboard includes
- **Key Metrics** — weekly revenue, employees on clock, open tasks, pending approvals, inventory alerts
- **My List** — quick view of your personal tasks right on the dashboard
- **Financial Overview** — revenue vs. costs chart, profit margin, cost breakdown bar
- **Team Status** — see who's clocked in, on lunch, or not yet in
- **Upcoming Schedule** — next events and appointments at a glance
- **Compliance & Tasks** — overdue items, upcoming deadlines, task distribution chart
- **Admin Work List** — progress bar showing how much of the daily list is done
- **Tasks Overview** — filterable list of all tasks with urgency color coding
- **Quick Navigation** — tiles to jump to Schedule, Employees, Payroll, Inventory, Analytics, Settings

### Employee Dashboard includes
- **My List** — your personal task list front and center
- **Metrics** — your open tasks and hours worked
- **Upcoming Events** — what's coming up on the schedule
- **Tasks Overview** — your assigned tasks with status and urgency

## Schedule Improvements

**Where to find it:** Sidebar > "Schedule"

- Events now show **day labels** (Today, Tomorrow, Thu, etc.) instead of just dates
- Events are **color-coded by type** for faster scanning
- **Time is displayed** alongside each event
- Admins can **toggle visibility** of schedule items for workers vs. admins

## Inventory — Worker Item Requests

**Where to find it:** Sidebar > "Inventory"

- Workers can now **request items** the shop doesn't currently stock
- Tap the request button on the inventory page to submit a new part/item request
- Admins see pending requests and can address or dismiss them from Admin > Inventory

## Tasks — Urgency Color Coding

**Where to find it:** Dashboard and Sidebar > "Tasks"

- Tasks now show **color-coded urgency** based on priority and due date
- Red = critical/overdue, Amber = high/due soon, Gold = medium, Gray = low
- Makes it easy to see at a glance what needs attention first

---

## Install as a Web App on Your Phone

You can add this app to your phone's home screen so it works like a regular app — full screen, fast, with the Spectrum Outfitters icon.

### iPhone / iPad (Safari)
1. Open Safari and go to the app URL
2. Tap the **Share** button (square with an arrow pointing up) at the bottom of the screen
3. Scroll down and tap **"Add to Home Screen"**
4. The name will auto-fill as "Spectrum Outfitters" — tap **Add**
5. The app icon now appears on your home screen — tap it to open in full-screen mode

### Android (Chrome)
1. Open Chrome and go to the app URL
2. Tap the **three-dot menu** (top-right corner)
3. Tap **"Add to Home screen"** or **"Install app"**
4. Confirm by tapping **Add**
5. The app icon appears on your home screen — tap it to open

> Tip: Once installed, the app opens without the browser toolbar and feels just like a native app. You'll still get update notifications inside the app.

---

## Need Help?

If anything looks different or you're not sure where to find something, check the sidebar navigation — all main sections are listed there. Admins can reorder navigation items from Admin > Settings.`;

export async function seedFeb2026Changelog() {
  try {
    const existing = await db.getAsync(
      'SELECT id FROM system_updates WHERE version = ?',
      [VERSION]
    );
    if (existing) return;

    // Get the first admin user to set as creator
    const admin = await db.getAsync(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
    );
    const creatorId = admin?.id || 1;

    await db.runAsync(`
      INSERT INTO system_updates (title, content, version, update_type, priority, is_active, is_pending, show_on_login, approved_by, approved_at, created_by)
      VALUES (?, ?, ?, 'feature', 'high', 1, 0, 1, ?, CURRENT_TIMESTAMP, ?)
    `, [TITLE, CONTENT, VERSION, creatorId, creatorId]);

    console.log('✅ Seeded February 2026 changelog (v' + VERSION + ')');
  } catch (err) {
    console.error('Changelog seed error:', err.message);
  }
}
