import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Key, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Building2, User } from 'lucide-react';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';
import { authApi } from '../api/auth.api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';

export const ActivateAccountPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const toast = useToast();

  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email?: string; name?: string; role?: string; hospital?: any } | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setIsValidating(false);
        setTokenValid(false);
        setErrorMessage('Activation token parameter is missing from the link.');
        return;
      }

      try {
        const res = await authApi.verifyToken(token, 'ACTIVATION');
        if (res?.valid) {
          setTokenValid(true);
          setUserInfo({
            email: res.email,
            name: (res as any).user?.name,
            role: (res as any).user?.role,
            hospital: (res as any).user?.hospital,
          });
        } else {
          setTokenValid(false);
          setErrorMessage('Activation link is invalid or has already been used.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setErrorMessage(err.message || 'Activation link is invalid or has expired.');
      } finally {
        setIsValidating(false);
      }
    };

    verify();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await authApi.activateAccount({ token, password });
      setIsSuccess(true);
      toast.success('Account Activated', 'Your official credentials have been activated successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to activate account. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-3">
          <Link to="/" className="inline-flex items-center justify-center group mb-1">
            <RocketWheelLogo size="lg" />
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Activate Staff Account
          </h1>
          <p className="text-xs text-slate-500">
            Complete your onboarding and create your official portal password
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <Card className="rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl border-slate-200">
          {isValidating ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-royal-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Validating official invitation token...</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Invalid or Expired Activation Link</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This activation link has either already been completed or has expired. Please contact your hospital administrator.
                </p>
              </div>
              <Link to="/staff/login" className="block pt-2">
                <Button className="w-full bg-royal-600 hover:bg-royal-700 text-white font-bold">
                  Go to Sign In
                </Button>
              </Link>
            </div>
          ) : isSuccess ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Account Activated!</h3>
                <p className="text-xs text-slate-500">
                  Your credentials have been securely activated. You may now sign in to your dashboard.
                </p>
              </div>
              <Button
                onClick={() => navigate('/staff/login')}
                className="w-full bg-royal-600 hover:bg-royal-700 text-white font-bold"
              >
                Sign In to Portal <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Account affiliation banner */}
              <div className="p-3.5 bg-royal-50/70 border border-royal-100 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-royal-900">
                  <ShieldCheck className="w-4 h-4 text-royal-600" />
                  <span>Official Institutional Invitation</span>
                </div>
                {userInfo?.hospital && (
                  <p className="text-royal-800">
                    Hospital: <strong>{userInfo.hospital.name}</strong>
                  </p>
                )}
                <p className="text-royal-800">
                  Email: <strong>{userInfo?.email}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Create Account Password
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full text-sm pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                    required
                    minLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full text-sm pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-royal-600 hover:bg-royal-700 text-white font-bold shadow-md shadow-royal-600/20 mt-2"
                isLoading={isLoading}
              >
                Activate Account & Enter Portal <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          <div className="border-t border-slate-100 pt-4 text-center">
            <Link
              to="/staff/login"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              Return to Staff Sign In
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
