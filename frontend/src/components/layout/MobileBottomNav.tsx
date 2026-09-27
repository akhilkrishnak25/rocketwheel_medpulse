import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Building2,
  Calendar,
  FileText,
  PhoneCall,
  X,
  ShieldAlert,
  Clock,
} from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* NATIVE-LIKE FIXED BOTTOM APP BAR (MOBILE ONLY) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-area-bottom shadow-[0_-4px_25px_rgba(0,0,0,0.07)]"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {/* 1. Home */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              isActive('/') && location.pathname === '/'
                ? 'text-royal-600 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Home
              className={`w-5 h-5 transition-transform ${
                isActive('/') && location.pathname === '/' ? 'scale-110 stroke-[2.5]' : ''
              }`}
            />
            <span className="text-[10px] mt-1 tracking-tight">Home</span>
          </Link>

          {/* 2. Hospitals Directory */}
          <Link
            to="/hospitals"
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              isActive('/hospitals')
                ? 'text-royal-600 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2
              className={`w-5 h-5 transition-transform ${
                isActive('/hospitals') ? 'scale-110 stroke-[2.5]' : ''
              }`}
            />
            <span className="text-[10px] mt-1 tracking-tight">Hospitals</span>
          </Link>

          {/* 3. Center Elevated Book Now Button */}
          <div className="flex flex-col items-center justify-center">
            <Link
              to="/hospitals"
              className="relative -top-4 w-13 h-13 rounded-full bg-gradient-to-tr from-royal-600 to-[#15179f] text-white p-3.5 shadow-lg shadow-royal-600/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all border-3 border-white"
              aria-label="Book Doctor Appointment"
            >
              <Calendar className="w-6 h-6 stroke-[2.5] text-white" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#FF1D6B] border-2 border-white animate-pulse"></span>
            </Link>
            <span className="text-[10px] font-bold text-royal-700 tracking-tight -mt-3">Book</span>
          </div>

          {/* 4. Check OP / Track Queue */}
          <Link
            to="/check-appointment"
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              isActive('/check-appointment')
                ? 'text-[#FF1D6B] font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText
              className={`w-5 h-5 transition-transform ${
                isActive('/check-appointment') ? 'scale-110 stroke-[2.5]' : ''
              }`}
            />
            <span className="text-[10px] mt-1 tracking-tight">My OP</span>
          </Link>

          {/* 5. Emergency SOS */}
          <button
            type="button"
            onClick={() => setEmergencyModalOpen(true)}
            className="flex flex-col items-center justify-center py-1 text-rose-600 active:scale-95 transition-transform"
          >
            <PhoneCall className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1 tracking-tight">Emergency</span>
          </button>
        </div>
      </nav>

      {/* QUICK EMERGENCY DIALER BOTTOM SHEET / MODAL */}
      {emergencyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setEmergencyModalOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl safe-area-bottom animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-black text-base">
                <ShieldAlert className="w-5 h-5" />
                24/7 Emergency Helplines
              </div>
              <button
                onClick={() => setEmergencyModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If this is a life-threatening medical emergency, call ambulance services immediately or head to the nearest accredited emergency department.
            </p>

            <div className="space-y-3">
              <a
                href="tel:108"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm">
                    108
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">National Ambulance Emergency</div>
                    <div className="text-[11px] text-rose-600 font-semibold">Toll-free 24/7 Immediate Dispatch</div>
                  </div>
                </div>
                <PhoneCall className="w-4 h-4 text-rose-600" />
              </a>

              <a
                href="tel:1066"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-royal-50 border border-royal-200 text-royal-700 hover:bg-royal-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-royal-600 text-white flex items-center justify-center font-black text-sm">
                    1066
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Apollo Hospitals Trauma Hotline</div>
                    <div className="text-[11px] text-royal-600 font-semibold">Cardiac & Stroke Immediate Response</div>
                  </div>
                </div>
                <PhoneCall className="w-4 h-4 text-royal-600" />
              </a>

              <a
                href="tel:1050"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black text-sm">
                    1050
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Fortis Emergency Helpline</div>
                    <div className="text-[11px] text-slate-500 font-semibold">Critical Care Hotline</div>
                  </div>
                </div>
                <PhoneCall className="w-4 h-4 text-slate-700" />
              </a>
            </div>

            <button
              onClick={() => setEmergencyModalOpen(false)}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
