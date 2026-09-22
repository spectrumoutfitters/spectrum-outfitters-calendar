const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { quoteShellPath } = require('../quoteShellPath');

describe('quoteShellPath', () => {
  it('wraps a Unix path with spaces in single quotes', () => {
    assert.equal(quoteShellPath('/opt/spectrum calendar/scripts/deploy.cjs', 'linux'), "'/opt/spectrum calendar/scripts/deploy.cjs'");
  });

  it('escapes a single quote so it cannot close the Unix quoting', () => {
    assert.equal(quoteShellPath("/tmp/o'brien/deploy.cjs", 'linux'), "'/tmp/o'\\''brien/deploy.cjs'");
  });

  it('keeps shell metacharacters inside the Unix quotes', () => {
    const quoted = quoteShellPath('/tmp/a;rm -rf / $(whoami)', 'linux');
    assert.equal(quoted, "'/tmp/a;rm -rf / $(whoami)'");
    assert.equal(quoted.startsWith("'"), true);
    assert.equal(quoted.endsWith("'"), true);
  });

  it('wraps a Windows path and doubles embedded quotes', () => {
    assert.equal(
      quoteShellPath('C:\\Program Files\\app\\"deploy".cjs', 'win32'),
      '"C:\\Program Files\\app\\""deploy"".cjs"'
    );
  });

  it('quotes an empty path rather than dropping the argument', () => {
    assert.equal(quoteShellPath('', 'linux'), "''");
    assert.equal(quoteShellPath('', 'win32'), '""');
  });
});
