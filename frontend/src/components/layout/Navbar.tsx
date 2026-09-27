import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Lock, Menu, X, ShieldCheck, Search, PhoneCall, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { RocketWheelLogo } from '../common/RocketWheelLogo';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Top Banner in Deep Royal Blue */}
      <div className="bg-[#15179f] text-slate-200 text-xs py-1.5 px-4 border-b border-royal-700/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#FF1D6B] animate-ping"></span>
            <span className="hidden sm:inline">24/7 National Emergency OPD Hotline:</span>
            <span className="font-bold text-white tracking-wide flex items-center gap-1">
              <PhoneCall className="w-3 h-3 text-[#FBA94C]" /> 1066 / +91 40 2360 7777
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="bg-[#FF1D6B] text-white px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider">
              Zero Login Needed
            </span>
            <span className="hidden md:inline text-blue-200">•</span>
            <span className="hidden md:flex items-center gap-1 text-[#FBA94C] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Instant Digital OP Slip
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo with exact typography & colors */}
          <Link to="/" className="flex items-center gap-2 group py-1">
            <RocketWheelLogo size="md" variant="dark" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7">
            <Link
              to="/hospitals"
              className={`text-sm font-semibold transition-colors ${
                isActive('/hospitals')
                  ? 'text-royal-600 font-bold'
                  : 'text-slate-600 hover:text-royal-600'
              }`}
            >
              Hospitals Directory
            </Link>
            <Link
              to="/#departments"
              className="text-sm font-semibold text-slate-600 hover:text-royal-600 transition-colors"
            >
              Specialities
            </Link>
            <Link
              to="/#how-it-works"
              className="text-sm font-semibold text-slate-600 hover:text-royal-600 transition-colors"
            >
              How It Works
            </Link>
            <Link
              to="/check-appointment"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors px-2.5 py-1.5 rounded-xl ${
                isActive('/check-appointment')
                  ? 'text-[#FF1D6B] bg-pink-50 font-bold'
                  : 'text-slate-600 hover:text-[#FF1D6B] hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4 text-[#FF1D6B]" />
              Check Appointment / OP
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/register-hospital">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-royal-600 text-xs font-semibold">
                Partner with Us
              </Button>
            </Link>
            <Link to="/staff/login">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-royal-600">
                <Lock className="w-3.5 h-3.5 mr-1" /> Staff Portal
              </Button>
            </Link>
            <Link to="/hospitals" className="inline-block text-white">
              <Button variant="primary" size="sm" className="shadow-md bg-royal-600 hover:bg-royal-700 !text-white text-white font-bold">
                <Calendar className="w-4 h-4 mr-1.5 text-white stroke-[2.5]" />
                <span className="text-white font-bold">Book Appointment</span>
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger menu toggle */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg">
          <Link
            to="/hospitals"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-semibold text-slate-700 hover:bg-royal-50 hover:text-royal-600"
          >
            Hospitals Directory
          </Link>
          <Link
            to="/check-appointment"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-semibold text-[#FF1D6B] bg-pink-50"
          >
            Check Appointment / Download OP
          </Link>
          <Link
            to="/staff/login"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-semibold text-slate-600 hover:bg-slate-50"
          >
            Staff Portal Login
          </Link>
        </div>
      )}
    </header>
  );
};
