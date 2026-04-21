import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import KanbanBoard from '../components/Tasks/KanbanBoard';
import MyWorkList from './MyWorkList';

const Tasks = () => {
  const [searchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const statusFilter = searchParams.get('status');

  // Admins default to All Tasks; employees default to My Tasks
  const [activeTab, setActiveTab] = useState(isAdmin ? 'all' : 'mine');

  useEffect(() => {
    // If there's a status filter in the URL, switch to All Tasks and scroll to that column
    if (statusFilter) {
      setActiveTab('all');
      setTimeout(() => {
        const columnElement = document.querySelector(`[data-column-id="${statusFilter}"]`);
        if (columnElement) {
          columnElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          columnElement.style.transition = 'background-color 0.3s';
          columnElement.style.backgroundColor = '#e0f2fe';
          setTimeout(() => {
            columnElement.style.backgroundColor = '';
          }, 2000);
        }
      }, 100);
    }
  }, [statusFilter]);

  return (
    <div>
      {/* Tab toggle */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700 mb-4">
        <button
          onClick={() => setActiveTab('mine')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'mine'
              ? 'border-primary text-primary dark:text-primary-light'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          My Tasks
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-primary text-primary dark:text-primary-light'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          All Tasks
        </button>
      </div>

      {activeTab === 'mine' && <MyWorkList />}
      {activeTab === 'all' && <KanbanBoard />}
    </div>
  );
};

export default Tasks;

