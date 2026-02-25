import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 w-full max-w-[1600px] mx-auto px-4 py-4 sm:px-5 md:px-6 md:py-6 lg:px-8 lg:py-8 text-gray-900 dark:text-neutral-100">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
