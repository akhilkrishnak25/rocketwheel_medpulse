import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity,
  LayoutDashboard,
  CalendarCheck2,
  Users,
  Bell,
  LogOut,
  Building2,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user || (user.role !== 'HOSPITAL_ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-bold text-slate-900">Hospital Admin Access Required</h2>
          <p className="text-xs text-slate-500">
            You must be logged in as a Hospital Administrator to access this dashboard.
          </p>
          <Link to="/staff/login">
            <Button variant="primary" size="sm">
              Go to Staff Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const hospitalName = user.hospital?.name || 'Hospital Administration';

  return (
    <div className="min-h-screen flex bg-slate-100 relative">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR: Drawer on mobile, static on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <Link to="/" className="inline-flex" onClick={() => setMobileMenuOpen(false)}>
            <RocketWheelLogo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
              Admin
            </span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current Hospital Badge */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-gold-400" />
            Hospital Facility
          </div>
          <div className="font-bold text-xs text-white line-clamp-2">
            {hospitalName}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 text-xs font-semibold">
          <Link
            to="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              location.pathname === '/admin'
                ? 'bg-royal-600 text-white shadow-sm shadow-royal-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Overview & KPIs
          </Link>

          <Link
            to="/admin#appointments"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <CalendarCheck2 className="w-4 h-4" />
            Appointments Management
          </Link>

          <Link
            to="/admin#doctors"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Users className="w-4 h-4" />
            Doctors & Schedules
          </Link>

          <Link
            to="/admin#notifications"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            System Notifications
          </Link>
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <div className="overflow-hidden mr-2">
            <p className="font-semibold text-white truncate">{user.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden"
              aria-label="Open navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Badge variant="info" className="font-bold text-[11px] sm:text-xs truncate max-w-[180px] sm:max-w-none">
              {hospitalName}
            </Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/" target="_blank" className="hidden sm:inline-block">
              <Button variant="ghost" size="sm" className="text-slate-500 text-xs">
                Public Website <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={logout} className="text-xs">
              Sign Out
            </Button>
          </div>
        </header>

        <main className="p-3.5 sm:p-6 md:p-8 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
