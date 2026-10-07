import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Building2,
  CalendarCheck2,
  Users,
  UserCheck,
  Shield,
  Bell,
  FlaskConical,
  LogOut,
  ExternalLink,
  Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>('appointments');

  useEffect(() => {
    const syncTab = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['appointments', 'doctors', 'patients', 'staff', 'subadmins', 'notifications', 'labs'].includes(hash)) {
        setCurrentTab(hash);
      } else {
        setCurrentTab('appointments');
      }
    };
    syncTab();
    window.addEventListener('hashchange', syncTab);
    return () => window.removeEventListener('hashchange', syncTab);
  }, [location]);

  // Responsive default: open on desktop (>= 1024px), closed on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const subPermissions: string[] = user?.subAdminPermissions || [];

  const navItems = [
    {
      id: 'appointments',
      label: 'Appointments Management',
      icon: CalendarCheck2,
      color: 'text-royal-400',
      allowed: !isSubAdmin || subPermissions.includes('OP_MANAGEMENT'),
    },
    {
      id: 'doctors',
      label: 'Doctors & Schedules',
      icon: Users,
      color: 'text-teal-400',
      allowed: !isSubAdmin || subPermissions.includes('DOCTOR_MANAGEMENT'),
    },
    {
      id: 'patients',
      label: 'Patient Records',
      icon: UserCheck,
      color: 'text-emerald-400',
      allowed: !isSubAdmin || subPermissions.includes('PATIENT_RECORDS'),
    },
    {
      id: 'staff',
      label: 'Support Staff Roster',
      icon: Users,
      color: 'text-amber-400',
      allowed: !isSubAdmin || subPermissions.includes('VITALS_MANAGEMENT'),
    },
    {
      id: 'subadmins',
      label: 'Sub-Administrators',
      icon: Shield,
      color: 'text-pink-400',
      allowed: !isSubAdmin,
    },
    {
      id: 'labs',
      label: 'Hospital Diagnostics / Labs',
      icon: FlaskConical,
      color: 'text-purple-400',
      allowed: !isSubAdmin || subPermissions.includes('LAB_MANAGEMENT'),
    },
    {
      id: 'notifications',
      label: 'System Notifications',
      icon: Bell,
      color: 'text-gold-400',
      allowed: true,
    },
  ];

  return (
    <div className="min-h-screen flex bg-slate-100 relative overflow-x-hidden">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 transition-all duration-300 ease-in-out lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-ml-64'
        }`}
      >
        {/* Sidebar Brand Header with 3 lines symbol */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex"
            onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
          >
            <RocketWheelLogo size="sm" />
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
              Admin
            </span>
            {/* 3 lines symbol to close sidebar */}
            <button
              onClick={() => setSidebarOpen(false)}
              title="Close dashboard sidebar (3 lines symbol)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close dashboard sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hospital Facility & Admin Card */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-royal-400" />
            Hospital Operations
          </div>
          <div className="font-bold text-xs text-white line-clamp-2">{hospitalName}</div>
          <div className="text-[10px] text-royal-400 font-mono mt-1">
            Code: {user.hospital?.code || 'RW-HOSP'}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-3 space-y-1 text-xs font-semibold overflow-y-auto">
          {navItems
            .filter((item) => item.allowed)
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-royal-600 text-white font-bold shadow-md shadow-royal-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.color}`} />
                  <span className="truncate">{item.label}</span>
                </a>
              );
            })}
        </nav>

        {/* User Footer: Public Website, Email & Sign Out */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2 text-xs">
          <Link
            to="/"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-royal-400" />
              Public Website
            </span>
          </Link>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 px-1">
            <div className="overflow-hidden mr-2">
              <p className="font-semibold text-white text-xs truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area with 3 lines symbol toggle */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Control Bar containing 3 lines symbol button to toggle sidebar */}
        <div className="px-4 sm:px-8 pt-4 pb-2 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Close sidebar (3 lines symbol)" : "Open sidebar (3 lines symbol)"}
            className="p-2 px-3 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-700 hover:text-royal-600 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 group"
            aria-label="Toggle dashboard sidebar"
          >
            <Menu className="w-5 h-5 text-slate-700 group-hover:text-royal-600 transition-transform group-hover:scale-105" />
            <span className="text-xs font-bold text-slate-700 group-hover:text-royal-600">
              {sidebarOpen ? 'Close Menu' : 'Open Menu'}
            </span>
          </button>
        </div>

        <main className="p-4 sm:p-6 lg:p-8 pt-2 sm:pt-2 lg:pt-2 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
