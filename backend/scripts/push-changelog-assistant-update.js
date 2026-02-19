/**
 * Set the Spectrum Outfitters Assistant announcement to "what the app does".
 * Updates the existing announcement if found, otherwise inserts. Run from backend: node scripts/push-changelog-assistant-update.js
 */
import db from '../database/db.js';

const CHANGELOG = {
  title: 'What is Spectrum Outfitters Assistant?',
  version: 'Feb 2025',
  update_type: 'announcement',
  priority: 'medium',
  content: `**Spectrum Outfitters Assistant** is a desktop app that gives you one place to search and launch things from your computer.

• **Global hotkey** — Press a shortcut (e.g. Ctrl+Shift+Space) from anywhere to open the dashboard, then type to search and press Enter to launch.

• **URLs, files, and apps** — Add links to websites, local files or folders, and applications. Organize them with categories and optional hotkeys per item.

• **Credentials** — Store usernames and passwords (encrypted) for items so you can log in quickly. Optional.

• **Sync** — Admins can push a single set of items, categories, and credentials to a server so everyone who uses the app stays in sync (pull on startup or manually).

• **Spectrum website** — In Settings you can point the app at a local project folder and start/stop the server, see status, and open the site.

Admins can download the installer from the sidebar. If you need it, ask an admin.`,
  show_on_login: 1,
  is_active: 1,
  is_pending: 0
};

async function pushChangelog() {
  const admin = await db.getAsync("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1");
  const createdBy = admin?.id ?? 1;
  const approvedBy = admin?.id ?? 1;

  const existing = await db.getAsync(
    "SELECT id FROM system_updates WHERE title LIKE '%Spectrum Outfitters Assistant%' OR title LIKE '%Dashboard Assistant%' ORDER BY id DESC LIMIT 1"
  );

  if (existing) {
    await db.runAsync(
      `UPDATE system_updates SET title = ?, content = ?, version = ?, update_type = ?, priority = ?,
       show_on_login = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        CHANGELOG.title,
        CHANGELOG.content,
        CHANGELOG.version,
        CHANGELOG.update_type,
        CHANGELOG.priority,
        CHANGELOG.show_on_login ? 1 : 0,
        existing.id
      ]
    );
    console.log('Changelog updated on site:', existing.id, CHANGELOG.title);
  } else {
    await db.runAsync(
      `INSERT INTO system_updates (
        title, content, version, update_type, priority,
        is_active, is_pending, show_on_login, created_by, approved_by, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        CHANGELOG.title,
        CHANGELOG.content,
        CHANGELOG.version,
        CHANGELOG.update_type,
        CHANGELOG.priority,
        CHANGELOG.is_active,
        CHANGELOG.is_pending,
        CHANGELOG.show_on_login ? 1 : 0,
        createdBy,
        approvedBy
      ]
    );
    const row = await db.getAsync('SELECT id, title, created_at FROM system_updates ORDER BY id DESC LIMIT 1');
    console.log('Changelog pushed to site:', row?.id, row?.title, row?.created_at);
  }
}

pushChangelog()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
