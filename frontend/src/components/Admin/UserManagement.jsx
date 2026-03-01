import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, toTitleCase } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: 'employee',
    hourly_rate: 0,
    weekly_salary: 0
  });
  const [loading, setLoading] = useState(true);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  useEffect(() => {
    loadUsers();
    checkMasterAdmin();
  }, []);

  const checkMasterAdmin = async () => {
    try {
      const response = await api.get('/payroll/access');
      setIsMasterAdmin(response.data.isMasterAdmin);
    } catch (error) {
      console.error('Error checking master admin status:', error);
    }
  };

  const togglePayrollAccess = async (userId, currentAccess) => {
    if (!confirm(`Are you sure you want to ${currentAccess ? 'revoke' : 'grant'} payroll access?`)) {
      return;
    }
    try {
      await api.put(`/payroll/admins/${userId}/access`, {
        payroll_access: !currentAccess
      });
      await loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating payroll access');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUser) {
        // When editing, don't send password field if it's empty
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        await api.put(`/users/${editingUser.id}`, updateData);
      } else {
        await api.post('/users', formData);
      }
      setShowForm(false);
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        email: '',
        full_name: '',
        role: 'employee',
        hourly_rate: 0,
        weekly_salary: 0
      });
      await loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      email: user.email || '',
      full_name: user.full_name,
      role: user.role,
      hourly_rate: user.hourly_rate || 0,
      weekly_salary: user.weekly_salary || 0
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      await loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to deactivate user');
    }
  };

  const handleResetPassword = async (id) => {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    try {
      await api.post(`/users/${id}/reset-password`, { newPassword });
      alert('Password reset successfully');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to reset password');
    }
  };

  if (loading && users.length === 0) {
    return <div className="text-center py-8 text-gray-600 dark:text-neutral-100">Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-neutral-100">User Management</h2>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({
              username: '',
              password: '',
              email: '',
              full_name: '',
              role: 'employee',
              hourly_rate: 0
            });
            setShowForm(true);
          }}
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-md"
        >
          + Add New User
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-lg dark:shadow-neutral-950/50 p-6 border-2 border-primary dark:border-neutral-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-semibold text-primary">
              {editingUser ? '✏️ Edit User' : '➕ Create New User'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingUser(null);
              }}
              className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 text-2xl"
            >
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  required
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                  />
                  <p className="text-xs text-gray-500 dark:text-neutral-100 mt-1">Password must be at least 6 characters</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  onBlur={(e) => {
                    if (e.target.value) {
                      setFormData({ ...formData, full_name: toTitleCase(e.target.value) });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Hourly Rate ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  placeholder="For hourly employees"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Weekly Salary ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.weekly_salary}
                  onChange={(e) => setFormData({ ...formData, weekly_salary: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  placeholder="For salaried employees"
                />
                <p className="text-xs text-gray-500 dark:text-neutral-100 mt-1">Hourly rate will be calculated as salary ÷ 40 hours</p>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
              >
                {loading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                }}
                className="px-6 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-100"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:shadow-neutral-950/50 overflow-hidden border border-transparent dark:border-neutral-700">
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-neutral-950">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Name</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Username</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Email</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Role</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Hourly Rate</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Weekly Salary</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Status</th>
              {isMasterAdmin && <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Payroll Access</th>}
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-neutral-100">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                <td className="py-3 px-4 text-gray-900 dark:text-neutral-100">{user.full_name}</td>
                <td className="py-3 px-4 text-gray-900 dark:text-neutral-100">{user.username}</td>
                <td className="py-3 px-4 text-gray-900 dark:text-neutral-100">{user.email || '—'}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-amber-600 dark:text-amber-400 font-medium">
                  {user.weekly_salary && user.weekly_salary > 0 
                    ? `$${((user.weekly_salary / 40).toFixed(2))}*` 
                    : `$${user.hourly_rate || 0}`}
                </td>
                <td className="py-3 px-4 text-amber-600 dark:text-amber-400 font-medium">
                  {user.weekly_salary && user.weekly_salary > 0 
                    ? `$${user.weekly_salary.toFixed(2)}` 
                    : '—'}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.is_active ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {isMasterAdmin && (
                  <td className="py-3 px-4">
                    {user.role === 'admin' ? (
                      <button
                        onClick={() => togglePayrollAccess(user.id, user.payroll_access === 1 || user.payroll_access === true)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          (user.payroll_access === 1 || user.payroll_access === true) || (user.is_master_admin === 1 || user.is_master_admin === true)
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800/50'
                            : 'bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-neutral-100 hover:bg-gray-200 dark:hover:bg-neutral-600'
                        }`}
                        disabled={user.is_master_admin === 1 || user.is_master_admin === true}
                        title={user.is_master_admin === 1 || user.is_master_admin === true ? 'Master admin always has access' : 'Toggle payroll access'}
                      >
                        {(user.is_master_admin === 1 || user.is_master_admin === true) ? '🔑 Master' : (user.payroll_access === 1 || user.payroll_access === true) ? '✓ Granted' : '✗ Denied'}
                      </button>
                    ) : (
                      <span className="text-gray-400 dark:text-neutral-500 text-xs">—</span>
                    )}
                  </td>
                )}
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-primary hover:underline text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleResetPassword(user.id)}
                      className="text-warning hover:underline text-sm"
                    >
                      Reset Password
                    </button>
                    {user.is_active && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-danger hover:underline text-sm"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;

