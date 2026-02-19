import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatTime, calculateElapsedTime } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';

const EmployeeStatusBar = () => {
  const { user, isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

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

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return; // Only show for admins
    }
    
    loadEmployeeStatus();
    // Refresh every 30 seconds
    const interval = setInterval(loadEmployeeStatus, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, [isAdmin]);

  // Update elapsed time every second for clocked-in employees
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

  if (!isAdmin || loading) {
    return null;
  }

  const clockedIn = employees.filter(e => e.clockedIn);
  const onLunch = employees.filter(e => e.onLunch);
  const totalActive = clockedIn.length + onLunch.length;

  return (
    <>
      {/* Compact Status Bar in Header */}
      <div 
        onClick={() => setShowModal(true)}
        className="cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-2 text-xs md:text-sm"
        title="Click to view employee status"
      >
        <span className="hidden sm:inline">👥</span>
        {clockedIn.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span>
            <span className="font-semibold">{clockedIn.length}</span>
            <span className="hidden md:inline">In</span>
          </span>
        )}
        {onLunch.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-pulse"></span>
            <span className="font-semibold">{onLunch.length}</span>
            <span className="hidden md:inline">Lunch</span>
          </span>
        )}
        {clockedIn.length === 0 && onLunch.length === 0 && (
          <span className="text-white/70">0 Active</span>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Employee Status</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-6">
              {/* Status Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">{clockedIn.length}</div>
                  <div className="text-sm text-green-600">Clocked In</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-700">{onLunch.length}</div>
                  <div className="text-sm text-orange-600">On Lunch</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-700">
                    {employees.filter(e => !e.clockedIn && !e.onLunch && e.lastActivity).length}
                  </div>
                  <div className="text-sm text-gray-600">Clocked Out</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">{employees.length}</div>
                  <div className="text-sm text-blue-600">Total Employees</div>
                </div>
              </div>

              {/* Employee List */}
              <div className="space-y-3">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    className={`border rounded-lg p-4 ${
                      employee.clockedIn ? 'bg-green-50 border-green-200' :
                      employee.onLunch ? 'bg-orange-50 border-orange-200' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-800">{employee.full_name}</h3>
                          {employee.role === 'admin' && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                              Admin
                            </span>
                          )}
                          {employee.clockedIn && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold flex items-center gap-1">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              Clocked In
                            </span>
                          )}
                          {employee.onLunch && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold flex items-center gap-1">
                              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                              On Lunch
                            </span>
                          )}
                        </div>
                        
                        {employee.clockedIn && (
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>Clocked in: <span className="font-medium">{formatTime(employee.clockInTime)}</span></div>
                            <div className="text-green-700 font-semibold">
                              Elapsed: {employee.elapsedHours || calculateElapsedTime(employee.clockInTime)}
                            </div>
                          </div>
                        )}
                        
                        {employee.onLunch && (
                          <div className="text-sm text-gray-600">
                            <div>Lunch started: <span className="font-medium">{formatTime(employee.lunchOutTime)}</span></div>
                            <div className="text-orange-600 font-semibold mt-1">On lunch break</div>
                          </div>
                        )}
                        
                        {!employee.clockedIn && !employee.onLunch && employee.lastActivity && (
                          <div className="text-sm text-gray-600">
                            Last activity: <span className="font-medium">{formatTime(employee.lastActivity)}</span>
                          </div>
                        )}
                        
                        {!employee.clockedIn && !employee.onLunch && !employee.lastActivity && (
                          <div className="text-sm text-gray-500 italic">No activity today</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    loadEmployeeStatus();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeeStatusBar;

