/**
 * Admin Reports rollup: weekly hours/pay and wall-clock task averages.
 * Distinct from Analytics labor-cost KPIs (#111) and task working-time
 * break clamp (#109) — this average uses started_at→completed_at only
 * (no break subtraction) and still divides by every completed row that
 * has completed_at, even when started_at is missing.
 */

export function calculateOverviewStats(overview) {
  if (!overview) return null;

  const stats = {
    totalHours: 0,
    totalPay: 0,
    activeEmployees: 0,
    tasksCompleted: 0,
    tasksInProgress: 0,
    avgTaskCompletion: 0,
  };

  if (overview.time?.report) {
    const timeData = overview.time.report;
    stats.totalHours = timeData.reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
    stats.totalPay = timeData.reduce((sum, e) => sum + parseFloat(e.pay || 0), 0);
    stats.activeEmployees = new Set(timeData.map((e) => e.user_id)).size;
  }

  if (overview.tasks?.tasks) {
    const tasks = overview.tasks.tasks;
    stats.tasksCompleted = tasks.filter((t) => t.status === 'completed').length;
    stats.tasksInProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const completedTasks = tasks.filter((t) => t.status === 'completed' && t.completed_at);
    if (completedTasks.length > 0) {
      const totalDuration = completedTasks.reduce((sum, t) => {
        if (t.started_at && t.completed_at) {
          const duration = (new Date(t.completed_at) - new Date(t.started_at)) / (1000 * 60 * 60);
          return sum + duration;
        }
        return sum;
      }, 0);
      stats.avgTaskCompletion = totalDuration / completedTasks.length;
    }
  }

  return stats;
}

export function groupTimePayrollByUser(report) {
  return (report || []).reduce((acc, entry) => {
    if (!acc[entry.user_id]) {
      acc[entry.user_id] = {
        user_name: entry.user_name,
        entries: [],
        totalHours: 0,
        totalPay: 0,
      };
    }
    acc[entry.user_id].entries.push(entry);
    acc[entry.user_id].totalHours += parseFloat(entry.hours || 0);
    acc[entry.user_id].totalPay += parseFloat(entry.pay || 0);
    return acc;
  }, {});
}
