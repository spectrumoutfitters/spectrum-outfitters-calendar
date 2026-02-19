import React, { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../Logo';
import { NavIcon } from './NavIcons';
import api from '../../utils/api';

const DEFAULT_NAV_ORDER = ['dashboard', 'mylist', 'tasks', 'time', 'schedule', 'inventory', 'products', 'profile', 'admin'];

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const [navOrder, setNavOrder] = useState(DEFAULT_NAV_ORDER);

  const allNavItems = [
    { path: '/dashboard', key: 'dashboard', label: 'Dashboard' },
    { path: '/my-list', key: 'mylist', label: 'My List' },
    { path: '/tasks', label: 'Tasks', key: 'tasks' },
    { path: '/time', label: 'Time Clock', key: 'time' },
    { path: '/schedule', label: 'Schedule', key: 'schedule' },
    { path: '/inventory', label: 'Inventory', key: 'inventory' },
    { path: '/products', label: 'Products', key: 'products' },
    { path: '/profile', label: 'Profile', key: 'profile' },
    { path: '/admin', label: 'Admin', key: 'admin', adminOnly: true },
  ];

  useEffect(() => {
    let cancelled = false;
    api.get('/settings/nav-order')
      .then((res) => {
        let order = res.data?.order;
        if (!cancelled && Array.isArray(order) && order.length > 0) {
          const missing = DEFAULT_NAV_ORDER.filter(k => !order.includes(k));
          if (missing.length > 0) {
            for (const key of missing) {
              const defaultIdx = DEFAULT_NAV_ORDER.indexOf(key);
              const insertAt = Math.min(defaultIdx, order.length);
              order = [...order];
              order.splice(insertAt, 0, key);
            }
          }
          setNavOrder(order);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  let navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);
  navItems = [...navItems].sort((a, b) => {
    const i = navOrder.indexOf(a.key);
    const j = navOrder.indexOf(b.key);
    const i_ = i === -1 ? 999 : i;
    const j_ = j === -1 ? 999 : j;
    return i_ - j_;
  });

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const navLinkClass = (isActive) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-primary-subtle text-primary'
        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
    }`;

  return (
    <>
      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-neutral-50 z-50 transform transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.08)' : 'none' }}
      >
        <div className="p-5 border-b border-neutral-100 flex justify-between items-center">
          <Link to="/dashboard" onClick={handleLinkClick} className="flex items-center min-w-0">
            <Logo size="md" showText={false} />
          </Link>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="p-3 overflow-y-auto h-[calc(100vh-88px)]">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const to = item.tab ? `${item.path}?tab=${item.tab}` : item.path;
              const isActive = location.pathname === item.path && (!item.tab || searchParams.get('tab') === item.tab);
              return (
                <li key={item.tab ? item.path + item.tab : item.path}>
                  <Link to={to} onClick={handleLinkClick} className={navLinkClass(isActive)}>
                    <NavIcon name={item.key} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
            {isAdmin && (
              <li className="pt-3 mt-3 border-t border-neutral-100">
                <a
                  href={import.meta.env.VITE_DASHBOARD_ASSISTANT_DOWNLOAD_URL || '/downloads/dashboard-assistant'}
                  download="SpectrumOutfittersAssistant-Setup.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleLinkClick}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  <img src="/spectrum-icon.png" alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                  <span className="text-sm">Download Assistant</span>
                </a>
              </li>
            )}
          </ul>
        </nav>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 min-h-[calc(100vh-65px)] bg-neutral-50 border-r border-neutral-200">
        <div className="p-6 border-b border-neutral-100">
          <Link to="/dashboard" className="flex justify-center items-center w-full">
            <Logo size="lg" showText={false} />
          </Link>
        </div>
        <nav className="p-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const to = item.tab ? `${item.path}?tab=${item.tab}` : item.path;
              const isActive = location.pathname === item.path && (!item.tab || searchParams.get('tab') === item.tab);
              return (
                <li key={item.tab ? item.path + item.tab : item.path}>
                  <Link to={to} className={navLinkClass(isActive)}>
                    <NavIcon name={item.key} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
            {isAdmin && (
              <li className="pt-3 mt-3 border-t border-neutral-100">
                <a
                  href={import.meta.env.VITE_DASHBOARD_ASSISTANT_DOWNLOAD_URL || '/downloads/dashboard-assistant'}
                  download="SpectrumOutfittersAssistant-Setup.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  <img src="/spectrum-icon.png" alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                  <span className="text-sm">Download Assistant</span>
                </a>
              </li>
            )}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
