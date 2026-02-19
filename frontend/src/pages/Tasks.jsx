import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import KanbanBoard from '../components/Tasks/KanbanBoard';

const Tasks = () => {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');

  useEffect(() => {
    // If there's a status filter in the URL, scroll to that column
    if (statusFilter) {
      setTimeout(() => {
        const columnElement = document.querySelector(`[data-column-id="${statusFilter}"]`);
        if (columnElement) {
          columnElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          // Highlight the column briefly
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
      <KanbanBoard />
    </div>
  );
};

export default Tasks;

