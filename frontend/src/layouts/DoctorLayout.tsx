import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { LogOut, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const DoctorLayout: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user || user.role !== 'DOCTOR') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-bold text-slate-900">Doctor Access Required</h2>
          <p className="text-xs text-slate-500">
            Please log in with an accredited Doctor account to access the OPD consultation queue.
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
                {user.name}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                Doctor
              </span>
              <Badge variant="success" className="text-[10px] py-0 px-2">
                OPD Active
              </Badge>
            </div>
            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-pink-300 font-semibold">{user.doctor?.specialization || 'Clinical Specialist'}</span>
              <span>•</span>
              <span className="text-slate-300 font-medium">{user.hospital?.name || 'Care Hospital'}</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline text-slate-400">{user.email}</span>
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
