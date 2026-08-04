import db from './db.js';

export async function addCustomerBookingsTable() {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS customer_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      vehicles_json TEXT,
      selected_services_json TEXT,
      notes TEXT,
      slot_start_iso TEXT NOT NULL,
      slot_end_iso TEXT NOT NULL,
      timezone TEXT,
      google_event_id TEXT,
      google_write_calendar_id TEXT,
      notify_emails_json TEXT,
      email_sent INTEGER DEFAULT 0,
      email_error TEXT,
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_customer_bookings_created ON customer_bookings(created_at)').catch(() => {});
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_customer_bookings_google ON customer_bookings(google_event_id)').catch(() => {});
  // Prevent concurrent FreeBusy TOCTOU double-books of the same write-calendar slot.
  await db.runAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_bookings_calendar_slot
     ON customer_bookings(google_write_calendar_id, slot_start_iso)
     WHERE status IS NULL OR status != 'cancelled'`
  ).catch(() => {});
}
