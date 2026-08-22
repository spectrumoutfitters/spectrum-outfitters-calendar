import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { shouldShowClockInHeader } from '../../utils/authRoleFlags';
import { useJumpPalette } from './JumpPalette';
import Logo from '../Logo';
import HeaderClockInOut from '../TimeClock/HeaderClockInOut';
import EmployeeStatusBar from '../EmployeeStatusBar/EmployeeStatusBar';
import UpdatesBadge from '../Updates/UpdatesBadge';
import ThemeToggle from '../ui/ThemeToggle';

const Header = ({ onMenuClick }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { openPalette } = useJumpPalette();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const showClockInOut = shouldShowClockInHeader(user);

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
          {isAdmin && (
            <button
              type="button"
              onClick={() => openPalette()}
              className="inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-2.5 text-xs font-semibold text-white hover:bg-white/18 active:bg-white/22 transition-colors sm:min-w-0 sm:px-3"
              title="Search and jump to any admin screen or page"
              aria-label="Search and jump"
            >
              <svg className="h-5 w-5 shrink-0 lg:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="font-medium lg:hidden">Search</span>
              <span className="hidden lg:inline text-white/95">Jump</span>
              <kbd className="hidden xl:inline rounded bg-black/25 px-1.5 py-0.5 font-mono text-[10px] text-white/85">
                ⌘K
              </kbd>
            </button>
          )}
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
