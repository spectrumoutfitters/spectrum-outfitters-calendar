import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Logo from '../Logo';
import HeaderClockInOut from '../TimeClock/HeaderClockInOut';
import EmployeeStatusBar from '../EmployeeStatusBar/EmployeeStatusBar';
import UpdatesBadge from '../Updates/UpdatesBadge';
import ThemeToggle from '../ui/ThemeToggle';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const showClockInOut = user?.show_clock_in_header !== false;

  return (
    <header className="bg-brand-black text-white sticky top-0 z-50 min-h-[3.25rem] flex items-center border-b border-white/10 shadow-sm">
      <div className="container mx-auto px-4 md:px-6 py-2 flex justify-between items-center min-h-[3.25rem] w-full">
        <div className="flex items-center gap-2 min-w-0 h-10">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div
            onClick={() => navigate('/dashboard')}
            className="cursor-pointer flex items-center min-w-0 h-full max-h-10 hover:opacity-90 transition-opacity"
          >
            <Logo size="header" showText={false} className="h-full" />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <ThemeToggle showLabel />
          <UpdatesBadge />
          <EmployeeStatusBar />
          {showClockInOut && (
            <div className="hidden md:block">
              <HeaderClockInOut />
            </div>
          )}
          <span className="text-xs md:text-sm text-white/90 hidden sm:block">
            {user?.full_name} {user?.role && `(${user?.role})`}
          </span>
          <span className="text-xs sm:hidden text-white/90">
            {user?.full_name?.split(' ')[0] || user?.username}
          </span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-primary transition-colors"
          >
            <span className="hidden sm:inline">Logout</span>
            <span className="sm:hidden">Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
