import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatTime, calculateElapsedTime } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';

const EmployeeStatus = () => {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployeeStatus();
    // Refresh every 30 seconds to keep status updated
    const interval = setInterval(loadEmployeeStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Also update elapsed time every second for clocked-in employees
  useEffect(() => {
    if (employees.length === 0) return;
    
    const interval = setInterval(() => {
      setEmployees(prev => prev.map(emp => {
        if (emp.clockedIn && emp.clockInTime) {
          return {
            ...emp,
            elapsedHours: calculateElapsedTime(emp.clockInTime)
          };
        }
        return emp;
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [employees.length]);

  const loadEmployeeStatus = async () => {
    try {
      const response = await api.get('/time/employees/status');
      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error('Error loading employee status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (employee) => {
    if (employee.clockedIn) {
      return (
        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 rounded-full text-sm font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Clocked In
        </span>
      );
    } else if (employee.onLunch) {
      return (
        <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 rounded-full text-sm font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
          On Lunch
        </span>
      );
    } else if (employee.lastActivity || employee.hoursWorkedToday) {
      return (
        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-full text-sm font-semibold">
          Clocked Out
        </span>
      );
    } else {
      return (
        <span className="px-3 py-1 bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-100 rounded-full text-sm font-semibold">
          Off Today
        </span>
      );
    }
  };

  const formatLastLogin = (lastLogin, daysSinceLogin) => {
    if (!lastLogin) {
      return { text: 'Never logged in', isWarning: true };
    }
    
    if (daysSinceLogin === null || daysSinceLogin === undefined) {
      // Calculate if not provided
      const loginDate = new Date(lastLogin);
      const now = new Date();
      const diffMs = now - loginDate;
      daysSinceLogin = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
    
    if (daysSinceLogin === 0) {
      return { text: 'Today', isWarning: false };
    } else if (daysSinceLogin === 1) {
      return { text: 'Yesterday', isWarning: false };
    } else if (daysSinceLogin < 7) {
      return { text: `${daysSinceLogin} days ago`, isWarning: false };
    } else if (daysSinceLogin < 30) {
      return { text: `${daysSinceLogin} days ago`, isWarning: true };
    } else {
      return { text: `${Math.floor(daysSinceLogin / 30)} month${Math.floor(daysSinceLogin / 30) > 1 ? 's' : ''} ago`, isWarning: true };
    }
  };

  const getStatusInfo = (employee) => {
    if (employee.clockedIn) {
      const elapsedTime = employee.elapsedHours || calculateElapsedTime(employee.clockInTime);
      const lastLoginInfo = formatLastLogin(employee.lastLogin, employee.daysSinceLogin);
      return (
        <div className="text-sm text-gray-600 dark:text-neutral-100">
          <div>Clocked in: <span className="font-medium">{formatTime(employee.clockInTime)}</span></div>
          <div className="text-primary font-semibold">Elapsed: {elapsedTime}</div>
          <div className={`mt-1 ${lastLoginInfo.isWarning ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-neutral-400'}`}>
            Last login: <span className="font-medium">{lastLoginInfo.text}</span>
          </div>
        </div>
      );
    } else if (employee.onLunch) {
      const lastLoginInfo = formatLastLogin(employee.lastLogin, employee.daysSinceLogin);
      return (
        <div className="text-sm text-gray-600 dark:text-neutral-100">
          <div>Lunch started: <span className="font-medium">{formatTime(employee.lunchOutTime)}</span></div>
          <div className="text-orange-600 dark:text-orange-400">On lunch break</div>
          <div className={`mt-1 ${lastLoginInfo.isWarning ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-neutral-400'}`}>
            Last login: <span className="font-medium">{lastLoginInfo.text}</span>
          </div>
        </div>
      );
    } else if (employee.lastActivity || employee.hoursWorkedToday) {
      const lastLoginInfo = formatLastLogin(employee.lastLogin, employee.daysSinceLogin);
      return (
        <div className="text-sm text-gray-600 dark:text-neutral-100">
          {employee.hoursWorkedToday && (
            <div className="text-green-700 dark:text-green-300 font-semibold mb-1">
              Worked: {parseFloat(employee.hoursWorkedToday).toFixed(2)} hrs today
            </div>
          )}
          {employee.lastActivity && (
            <div>Clocked out: <span className="font-medium">{formatTime(employee.lastActivity)}</span></div>
          )}
          {employee.cleanupAcknowledged && (
            <div className="text-blue-600 dark:text-blue-400 mt-1">
              ✓ Cleanup acknowledged
            </div>
          )}
          {employee.hoursWorkedToday && !employee.cleanupAcknowledged && (
            <div className="text-orange-600 dark:text-orange-400 mt-1">
              ⚠️ No cleanup acknowledgment
            </div>
          )}
          <div className={`mt-1 ${lastLoginInfo.isWarning ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-neutral-400'}`}>
            Last login: <span className="font-medium">{lastLoginInfo.text}</span>
          </div>
        </div>
      );
    } else {
      const lastLoginInfo = formatLastLogin(employee.lastLogin, employee.daysSinceLogin);
      return (
        <div className="text-sm text-gray-500 dark:text-neutral-400">
          <div className="italic">No activity today</div>
          <div className={`mt-1 ${lastLoginInfo.isWarning ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-gray-500 dark:text-neutral-400'}`}>
            Last login: <span className="font-medium">{lastLoginInfo.text}</span>
          </div>
        </div>
      );
    }
  };

  const handleDeleteEmployee = async (employee) => {
    // Prevent deleting yourself
    if (currentUser && employee.id === currentUser.id) {
      alert('❌ You cannot delete your own account');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${employee.full_name}?\n\nThis will deactivate their account and they will no longer be able to log in.\n\nThis action can be undone by reactivating the user in User Management.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await api.delete(`/users/${employee.id}`);
      // Reload the employee list
      await loadEmployeeStatus();
      alert(`✅ ${employee.full_name} has been deactivated successfully`);
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert(error.response?.data?.error || 'Failed to delete employee');
    }
  };

  // Group employees by status
  const clockedIn = employees.filter(e => e.clockedIn);
  const onLunch = employees.filter(e => e.onLunch);
  const clockedOut = employees.filter(e => !e.clockedIn && !e.onLunch && (e.lastActivity || e.hoursWorkedToday));
  const offToday = employees.filter(e => !e.clockedIn && !e.onLunch && !e.lastActivity && !e.hoursWorkedToday);

  if (loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-neutral-100">Loading employee status...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-neutral-100">Employee Status</h2>
        <button
          onClick={loadEmployeeStatus}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">{clockedIn.length}</div>
          <div className="text-sm text-green-600 dark:text-green-400">Clocked In</div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{onLunch.length}</div>
          <div className="text-sm text-orange-600 dark:text-orange-400">On Lunch</div>
        </div>
        <div className="bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-700 dark:text-neutral-100">{clockedOut.length}</div>
          <div className="text-sm text-gray-600 dark:text-neutral-100">Clocked Out</div>
        </div>
        <div className="bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-500 dark:text-neutral-100">{offToday.length}</div>
          <div className="text-sm text-gray-500 dark:text-neutral-400">Off Today</div>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:shadow-neutral-950/50 overflow-hidden border border-transparent dark:border-neutral-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px]">
            <thead className="bg-gray-50 dark:bg-neutral-950">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Employee</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Details</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500 dark:text-neutral-400">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((employee) => {
                  const lastLoginInfo = formatLastLogin(employee.lastLogin, employee.daysSinceLogin);
                  const hasLongInactivity = lastLoginInfo.isWarning && (employee.daysSinceLogin >= 7);
                  
                  return (
                    <tr 
                      key={employee.id} 
                      className={`border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 ${
                        hasLongInactivity ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 md:px-4">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-900 dark:text-neutral-100">{employee.full_name}</div>
                          {employee.role === 'admin' && (
                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 rounded text-xs font-medium">
                              Admin
                            </span>
                          )}
                          {hasLongInactivity && (
                            <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-200 rounded text-xs font-medium" title="Hasn't logged in for 7+ days">
                              ⚠️ Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-neutral-400">{employee.username}</div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(employee)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusInfo(employee)}
                      </td>
                      <td className="py-3 px-4">
                        {currentUser && employee.id === currentUser.id ? (
                          <span className="text-sm text-gray-400 dark:text-neutral-500 italic">Cannot delete yourself</span>
                        ) : (
                          <button
                            onClick={() => handleDeleteEmployee(employee)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition active:scale-95"
                            title="Deactivate employee account"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeStatus;

