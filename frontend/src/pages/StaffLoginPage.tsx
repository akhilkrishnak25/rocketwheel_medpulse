import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Key, ArrowRight, AlertCircle, Eye, EyeOff, ShieldCheck, Building2 } from 'lucide-react';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';

export const StaffLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both your official email address and password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await login(email, password);
      toast.success('Welcome back, ' + user.name);

      // Strict database-driven role routing
      if (user.role === 'SUPER_ADMIN') {
        navigate('/super-admin');
      } else if (user.role === 'HOSPITAL_ADMIN' || user.role === 'HOSPITAL_SUB_ADMIN') {
        navigate('/admin');
      } else if (user.role === 'DOCTOR') {
        navigate('/doctor');
      } else if (user.role === 'SUPPORT_STAFF') {
        navigate('/staff/queue');
      } else if (user.role === 'LAB_TECHNICIAN') {
        navigate('/lab/queue');
      } else if (user.role === 'PHARMACY_STAFF') {
        navigate('/pharmacy/queue');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      const message = err.message || 'Login failed. Please verify your credentials.';
      setErrorMessage(message);
      toast.error('Authentication Notice', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <Link to="/" className="inline-flex items-center justify-center group mb-1">
            <RocketWheelLogo size="lg" />
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Staff & Clinical Portal
          </h1>
          <p className="text-xs text-slate-500">
            Official secure access for Super Administrators, Hospital Administrators, and Doctors
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <Card className="rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@hospital.org"
                  className="w-full text-sm pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <Link
                  to="/staff/forgot-password"
                  className="text-xs font-semibold text-royal-600 hover:text-royal-800 transition"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-royal-600 hover:bg-royal-700 text-white font-bold shadow-md shadow-royal-600/20 mt-2"
              isLoading={isLoading}
            >
              Sign In to Portal <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* New Hospital Partner Registration CTA */}
          <div className="border-t border-slate-100 pt-5 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Is your healthcare institution new to the MediPulse network?
            </p>
            <div>
              <Link
                to="/register-hospital"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-royal-600 hover:text-royal-800 transition"
              >
                <Building2 className="w-3.5 h-3.5" /> Register / Onboard Hospital
              </Link>
            </div>
            <div className="pt-2 border-t border-dashed border-slate-200">
              <Link
                to="/register-staff"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-pink-600 hover:text-pink-800 transition"
              >
                Doctor, Nurse, Lab, or Pharmacy? Register Here →
              </Link>
            </div>
          </div>
        </Card>

        <div className="text-center">
          <Link to="/" className="text-xs text-slate-500 hover:text-slate-800 transition inline-flex items-center gap-1">
            ← Return to Rocket Wheel Patient Discovery
          </Link>
        </div>
      </div>
    </div>
  );
};
