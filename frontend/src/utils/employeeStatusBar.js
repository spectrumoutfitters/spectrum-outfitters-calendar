/**
 * Header employee-status counts (EmployeeStatusBar).
 *
 * Clocked-in and on-lunch are independent filters, so a row with both flags
 * is counted in both badges. Clocked out requires lastActivity and neither
 * flag. hoursWorkedToday alone does not count as clocked out.
 */

export function countEmployeeStatusBar(employees) {
  const list = Array.isArray(employees) ? employees : [];
  const clockedIn = list.filter((employee) => employee.clockedIn).length;
  const onLunch = list.filter((employee) => employee.onLunch).length;
  const clockedOut = list.filter(
    (employee) => !employee.clockedIn && !employee.onLunch && employee.lastActivity
  ).length;

  return {
    clockedIn,
    onLunch,
    clockedOut,
    total: list.length,
    active: clockedIn + onLunch,
  };
}
