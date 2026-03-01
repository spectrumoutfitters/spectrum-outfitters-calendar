import db from './db.js';

export async function addTimeclockLocationColumns() {
  try {
    const info = await db.allAsync('PRAGMA table_info(time_entries)');
    const names = new Set((info || []).map(c => c.name));

    const columns = [
      { name: 'clock_in_lat',              sql: 'ALTER TABLE time_entries ADD COLUMN clock_in_lat REAL' },
      { name: 'clock_in_lng',              sql: 'ALTER TABLE time_entries ADD COLUMN clock_in_lng REAL' },
      { name: 'clock_out_lat',             sql: 'ALTER TABLE time_entries ADD COLUMN clock_out_lat REAL' },
      { name: 'clock_out_lng',             sql: 'ALTER TABLE time_entries ADD COLUMN clock_out_lng REAL' },
      { name: 'clock_in_distance_meters',  sql: 'ALTER TABLE time_entries ADD COLUMN clock_in_distance_meters REAL' },
      { name: 'location_verified',         sql: 'ALTER TABLE time_entries ADD COLUMN location_verified INTEGER DEFAULT 0' },
    ];

    for (const col of columns) {
      if (!names.has(col.name)) {
        await db.runAsync(col.sql).catch(() => {});
      }
    }
  } catch (_) {}
}
