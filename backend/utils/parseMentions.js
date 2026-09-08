/**
 * Resolve @username mentions in chat messages.
 * Socket board-send handlers call this before INSERT — it must never throw,
 * or team/admin board messages are dropped.
 */

const MENTION_RE = /@(\w+)/g;

/**
 * Unique @username tokens in display order (case preserved from first occurrence).
 */
export function extractMentionUsernames(message) {
  if (typeof message !== 'string' || !message) return [];
  const seen = new Set();
  const names = [];
  MENTION_RE.lastIndex = 0;
  let match;
  while ((match = MENTION_RE.exec(message)) !== null) {
    const raw = match[1];
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(raw);
  }
  return names;
}

/**
 * Drop inactive / malformed rows. Admin board mentions must not notify employees
 * (REST already 403s GET /admin-board for non-admins).
 */
export function filterMentionUsers(users, { boardType } = {}) {
  const list = Array.isArray(users)
    ? users.filter((u) => u && u.id != null)
    : [];
  if (boardType === 'admin_board') {
    return list.filter((u) => u.role === 'admin');
  }
  return list;
}

/**
 * @param {string} message
 * @param {{ lookupUsers?: (usernames: string[]) => Promise<Array<{id:number, username?:string, full_name?:string, role?:string}>>, boardType?: string }} [opts]
 * @returns {Promise<Array<object>>}
 */
export async function parseMentions(message, opts = {}) {
  try {
    const usernames = extractMentionUsernames(message);
    if (usernames.length === 0) return [];
    const { lookupUsers, boardType } = opts;
    const users = typeof lookupUsers === 'function' ? await lookupUsers(usernames) : [];
    return filterMentionUsers(users, { boardType });
  } catch {
    return [];
  }
}
