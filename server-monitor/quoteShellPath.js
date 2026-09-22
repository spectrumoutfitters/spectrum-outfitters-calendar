/**
 * Quote a filesystem path for the monitor's shell deploy command.
 * Windows cmd wraps in double quotes and escapes " as "".
 * Other platforms wrap in single quotes and escape ' as '\''.
 */
function quoteShellPath(p, platform = process.platform) {
  const s = String(p);
  if (platform === 'win32') return '"' + s.replace(/"/g, '""') + '"';
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

module.exports = { quoteShellPath };
