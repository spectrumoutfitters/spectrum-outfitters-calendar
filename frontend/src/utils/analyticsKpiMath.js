/**
 * Admin Analytics dashboard KPI rollup (labor hours / cost / completion).
 * Distinct from backend analytics week-window rates (#97): this is the
 * frontend cost model — hourly_rate, else weekly_salary / 40.
 */

export function calculateAnalyticsKpis(dashboardData) {
  if (!dashboardData?.performance) return null;

  const employees = dashboardData.performance.employees || [];
  const totalHours = employees.reduce((sum, e) => sum + parseFloat(e.total_hours_worked || 0), 0);
  const totalTasks = employees.reduce((sum, e) => sum + (e.tasks_completed || 0), 0);
  const avgTasksPerHour = totalHours > 0 ? (totalTasks / totalHours).toFixed(2) : '0.00';
  const avgCompletionRate = employees.length > 0
    ? (employees.reduce((sum, e) => sum + parseFloat(e.completion_rate || 0), 0) / employees.length).toFixed(1)
    : '0.0';
  const totalCost = employees.reduce((sum, e) => {
    const hourlyRate = e.hourly_rate || (e.weekly_salary ? e.weekly_salary / 40 : 0);
    return sum + (parseFloat(e.total_hours_worked || 0) * hourlyRate);
  }, 0);

  return {
    totalHours,
    totalTasks,
    avgTasksPerHour,
    avgCompletionRate,
    totalCost,
    activeEmployees: employees.length,
  };
}
