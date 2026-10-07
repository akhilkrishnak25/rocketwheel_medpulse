import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Users,
  BookOpen,
  FlaskConical,
  Clock,
  Calendar,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Stethoscope,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const DoctorLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>('queue');

  useEffect(() => {
    const syncTab = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['queue', 'templates', 'labs', 'roster', 'leaves'].includes(hash)) {
        setCurrentTab(hash);
      } else {
        setCurrentTab('queue');
      }
    };
    syncTab();
    window.addEventListener('hashchange', syncTab);
    return () => window.removeEventListener('hashchange', syncTab);
  }, [location]);

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

  const navItems = [
    {
      id: 'queue',
      label: "Today's OPD Queue",
      icon: Users,
      color: 'text-royal-400',
    },
    {
      id: 'templates',
      label: 'Rx Templates',
      icon: BookOpen,
      color: 'text-amber-400',
    },
    {
      id: 'labs',
      label: 'Diagnostic Lab Requests',
      icon: FlaskConical,
      color: 'text-purple-400',
    },
    {
      id: 'roster',
      label: 'My Roster & Hours',
      icon: Clock,
      color: 'text-emerald-400',
    },
    {
      id: 'leaves',
      label: 'Leave Management',
      icon: Calendar,
      color: 'text-rose-400',
    },
  ];

  return (
    <div className="min-h-screen flex bg-slate-100 relative">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Floating Mobile Toggle Button (Only on mobile when sidebar is closed) */}
      {!mobileMenuOpen && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="fixed bottom-5 right-5 z-40 md:hidden bg-slate-900 text-white p-3.5 rounded-full shadow-xl border border-slate-700 flex items-center gap-2"
          aria-label="Open Doctor Menu"
        >
          <Menu className="w-5 h-5 text-pink-400" />
          <span className="text-xs font-bold">Doctor Menu</span>
        </button>
      )}

      {/* Left Sidebar - Preserved from first image with all tabs & actions integrated */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <Link to="/" className="inline-flex" onClick={() => setMobileMenuOpen(false)}>
            <RocketWheelLogo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
              Doctor
            </span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Doctor Identity & Hospital Card */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="font-bold text-sm text-white">{user.name}</div>
            <Badge variant="success" className="text-[10px] py-0 px-1.5 font-bold">
              OPD Active
            </Badge>
          </div>
          <div className="text-[11px] text-pink-400 font-semibold mt-0.5">
            {user.doctor?.specialization || 'Mbbs / Clinical Specialist'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Stethoscope className="w-3 h-3 text-royal-400" />
            <span className="truncate">{user.hospital?.name || 'Hospital Clinical OPD'}</span>
          </div>
        </div>

        {/* Navigation Tabs - All doctor options integrated directly in sidebar */}
        <nav className="flex-1 p-3 space-y-1.5 text-xs font-semibold overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMobileMenuOpen(false)}
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

      {/* Main Full-Width Content Container - ZERO TOP NAV BAR */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="p-4 sm:p-6 md:p-8 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
