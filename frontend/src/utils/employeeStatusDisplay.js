/**
 * Employee Status last-login copy and presence buckets.
 * daysSinceLogin uses strict === 0 / === 1 (string '0'/'1' are not Today/Yesterday).
 */

export function formatLastLogin(lastLogin, daysSinceLogin, now = new Date()) {
  if (!lastLogin) {
    return { text: 'Never logged in', isWarning: true };
  }

  if (daysSinceLogin === null || daysSinceLogin === undefined) {
    const loginDate = new Date(lastLogin);
    const diffMs = now - loginDate;
    daysSinceLogin = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  if (daysSinceLogin === 0) {
    return { text: 'Today', isWarning: false };
  }
  if (daysSinceLogin === 1) {
    return { text: 'Yesterday', isWarning: false };
  }
  if (daysSinceLogin < 7) {
    return { text: `${daysSinceLogin} days ago`, isWarning: false };
  }
  if (daysSinceLogin < 30) {
    return { text: `${daysSinceLogin} days ago`, isWarning: true };
  }
  const months = Math.floor(daysSinceLogin / 30);
  return {
    text: `${months} month${months > 1 ? 's' : ''} ago`,
    isWarning: true,
  };
}

/** Row highlight uses the raw days field (>= 7), not the computed label. */
export function hasLongInactivity(lastLoginInfo, daysSinceLogin) {
  return Boolean(lastLoginInfo?.isWarning && daysSinceLogin >= 7);
}

/**
 * Presence buckets match EmployeeStatus grouping.
 * clockedIn wins over onLunch. hoursWorkedToday 0 is falsy → off today; '0' is truthy → clocked out.
 */
export function classifyEmployeePresence(employee) {
  if (employee.clockedIn) return 'clocked_in';
  if (employee.onLunch) return 'on_lunch';
  if (employee.lastActivity || employee.hoursWorkedToday) return 'clocked_out';
  return 'off_today';
}
