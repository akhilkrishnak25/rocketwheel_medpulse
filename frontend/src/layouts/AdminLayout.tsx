import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { LogOut, ExternalLink, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user || (user.role !== 'HOSPITAL_ADMIN' && user.role !== 'HOSPITAL_SUB_ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-bold text-slate-900">Hospital Admin Access Required</h2>
          <p className="text-xs text-slate-500">
            Please log in with an authorized Hospital Administrator or Sub-Admin account.
          </p>
          <Link to="/staff/login">
            <Button variant="primary" size="sm">
              Staff Portal Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const hospitalName = user.hospital?.name || 'Hospital Operations Portal';
  const isSubAdmin = user.role === 'HOSPITAL_SUB_ADMIN';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Unified Top Portal Header - Replaces sidebar and topbar with full-width integrated header */}
      <header className="bg-slate-900 text-white px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex">
            <RocketWheelLogo size="sm" />
          </Link>
          <div className="border-l border-slate-700 pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm text-white">
                {hospitalName}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                {isSubAdmin ? (user.hospitalSubAdmin?.roleTitle || 'Hospital Sub-Admin') : 'Hospital Admin'}
              </span>
              <Badge variant="info" className="text-[10px] py-0 px-2 font-mono">
                {user.hospital?.code || 'RW-HOSP'}
              </Badge>
            </div>
            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
              <span>Admin: <strong className="text-slate-200">{user.name}</strong></span>
              <span>•</span>
              <span className="text-slate-400">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <Link to="/" target="_blank" className="hidden sm:inline-block">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs">
              Public Website <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      {/* Main Full-Width Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};
