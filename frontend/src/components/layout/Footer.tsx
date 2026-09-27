import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Award, Phone, Mail, MapPin } from 'lucide-react';
import { RocketWheelLogo } from '../common/RocketWheelLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0f117a] text-slate-300 border-t border-royal-800 pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-block">
              <RocketWheelLogo size="md" variant="on-blue" showSubtitle={true} />
            </Link>
            <p className="text-sm text-slate-300 leading-relaxed max-w-sm pt-2">
              India's premier rapid outpatient booking network.
              Guaranteed time slot locking, online payments, and instant official Digital OP slips without patient login friction.
            </p>
            <div className="flex items-center gap-2 text-xs text-blue-100 bg-[#15179f] p-3 rounded-xl border border-royal-700/60 max-w-sm">
              <ShieldCheck className="w-4 h-4 text-[#FBA94C] shrink-0" />
              <span>JCI & NABH accredited partner facilities. 100% verified digital hospital slips.</span>
            </div>
          </div>

          {/* Patient Services */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FBA94C] mb-4">
              Patient Services
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/hospitals" className="hover:text-white transition-colors">
                  Find Hospitals
                </Link>
              </li>
              <li>
                <Link to="/check-appointment" className="hover:text-white transition-colors">
                  Check Appointment
                </Link>
              </li>
              <li>
                <Link to="/check-appointment" className="text-[#FF1D6B] font-semibold hover:underline">
                  Download Digital OP
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
            </ul>
          </div>

          {/* Hospital Network */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FBA94C] mb-4">
              Hospital Network
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>Apollo Hospitals, Jubilee Hills</li>
              <li>Fortis Hospital, Bengaluru</li>
              <li>Max Super Speciality, Saket</li>
              <li>Manipal Hospital, Whitefield</li>
              <li>AIIMS, New Delhi</li>
            </ul>
          </div>

          {/* Staff & Governance */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FBA94C] mb-4">
              Staff Portal
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/staff/login" className="text-white hover:text-[#FBA94C] font-semibold flex items-center gap-1">
                  Hospital Admin Login →
                </Link>
              </li>
              <li>
                <Link to="/staff/login" className="text-white hover:text-[#FBA94C] font-semibold flex items-center gap-1">
                  Doctor OPD Suite →
                </Link>
              </li>
              <li>
                <Link to="/staff/login" className="hover:text-white transition-colors">
                  Super Admin Console
                </Link>
              </li>
              <li className="pt-2 text-xs text-blue-200">
                Support: care@rocketwheel.org
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-royal-800 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-200 gap-4">
          <p>© {new Date().getFullYear()} Rocket Wheel Healthcare Systems. All rights reserved.</p>
          <p className="flex items-center gap-1 text-slate-300 font-medium">
            <Award className="w-3.5 h-3.5 text-[#FBA94C]" />
            Accelerating dignified, friction-free healthcare access.
          </p>
        </div>
      </div>
    </footer>
  );
};
