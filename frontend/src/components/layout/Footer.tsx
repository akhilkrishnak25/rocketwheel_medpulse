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

          {/* Staff & Governance & Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FBA94C] mb-4">
              Direct Contact & Support
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="tel:+919182238568"
                  className="flex items-center gap-2 text-white hover:text-[#FBA94C] transition-colors"
                >
                  <Phone className="w-4 h-4 text-[#FBA94C] shrink-0" />
                  <span className="font-bold">+91 91822 38568</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:rocketwheelorg@gmail.com"
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                >
                  <Mail className="w-4 h-4 text-[#FF1D6B] shrink-0" />
                  <span className="text-xs font-medium break-all">rocketwheelorg@gmail.com</span>
                </a>
              </li>
              <li className="pt-2 border-t border-royal-700/50">
                <Link to="/staff/login" className="text-white hover:text-[#FBA94C] font-semibold flex items-center gap-1 text-xs">
                  Staff & Doctor Portal →
                </Link>
              </li>
              <li>
                <Link to="/staff/login" className="text-slate-300 hover:text-white text-xs">
                  Hospital Admin Login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Compact Mobile Contact Bar */}
        <div className="md:hidden mt-8 pt-6 border-t border-royal-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <a
              href="tel:+919182238568"
              className="flex-1 py-2.5 px-3 rounded-xl bg-royal-700/60 border border-royal-600/50 flex items-center justify-center gap-2 text-xs font-bold text-white active:bg-royal-700"
            >
              <Phone className="w-4 h-4 text-[#FBA94C]" />
              Call Support
            </a>
            <a
              href="mailto:rocketwheelorg@gmail.com"
              className="flex-1 py-2.5 px-3 rounded-xl bg-royal-700/60 border border-royal-600/50 flex items-center justify-center gap-2 text-xs font-bold text-white active:bg-royal-700"
            >
              <Mail className="w-4 h-4 text-[#FF1D6B]" />
              Email Us
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-royal-800 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-200 gap-4">
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
