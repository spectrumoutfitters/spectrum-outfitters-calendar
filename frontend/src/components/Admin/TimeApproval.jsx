import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';

const TimeApproval = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, all

  useEffect(() => {
    loadTimeOffRequests();
  }, [filter]);

  const loadTimeOffRequests = async () => {
    setLoading(true);
    try {
      // Get all schedule entries, we'll filter by status on the frontend
      const response = await api.get('/schedule');
      let allRequests = response.data.entries || [];
      
      // Filter to only show time off requests (not admin-created day_off entries)
      allRequests = allRequests.filter(req => 
        req.type === 'time_off_request' || req.status === 'pending'
      );
      
      // Apply status filter
      if (filter !== 'all') {
        allRequests = allRequests.filter(req => req.status === filter);
      }
      
      // Sort by start date (most recent first)
      allRequests.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
      
      setRequests(allRequests);
    } catch (error) {
      console.error('Error loading time off requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id, approved) => {
    try {
      await api.post(`/schedule/${id}/approve`, { approved });
      await loadTimeOffRequests();
    } catch (error) {
      alert(error.response?.data?.error || `Failed to ${approved ? 'approve' : 'reject'} request`);
    }
  };

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    return diffDays;
  };

  if (loading) {
    return <div className="text-center py-8">Loading time off requests...</div>;
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Time Off Requests</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'pending'
                ? 'bg-yellow-500 text-white font-semibold'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'approved'
                ? 'bg-green-500 text-white font-semibold'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'rejected'
                ? 'bg-red-500 text-white font-semibold'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'all'
                ? 'bg-primary text-white font-semibold'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500 text-lg">
            {filter === 'pending' 
              ? 'No pending time off requests' 
              : filter === 'approved'
              ? 'No approved requests'
              : filter === 'rejected'
              ? 'No rejected requests'
              : 'No time off requests found'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const days = calculateDays(request.start_date, request.end_date);
            const isPending = request.status === 'pending';
            
            return (
              <div
                key={request.id}
                className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
                  request.status === 'approved' ? 'border-green-500' :
                  request.status === 'rejected' ? 'border-red-500' :
                  'border-yellow-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{request.user_name}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.status === 'approved' ? '✓ Approved' :
                         request.status === 'rejected' ? '✗ Rejected' :
                         '⏳ Pending'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-600">Start Date</p>
                        <p className="font-semibold">{formatDate(request.start_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">End Date</p>
                        <p className="font-semibold">{formatDate(request.end_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Duration</p>
                        <p className="font-semibold">{days} {days === 1 ? 'day' : 'days'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Requested</p>
                        <p className="font-semibold">{formatDate(request.created_at)}</p>
                      </div>
                    </div>

                    {request.reason && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600">Reason</p>
                        <p className="font-medium">{request.reason}</p>
                      </div>
                    )}

                    {request.notes && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Notes</p>
                        <p className="text-gray-700">{request.notes}</p>
                      </div>
                    )}

                    {request.approved_by_name && (
                      <div className="mt-4 text-sm text-gray-600">
                        {request.status === 'approved' ? 'Approved' : 'Rejected'} by {request.approved_by_name} on {formatDate(request.approved_at)}
                      </div>
                    )}
                  </div>

                  {isPending && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(request.id, true)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleApprove(request.id, false)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimeApproval;

