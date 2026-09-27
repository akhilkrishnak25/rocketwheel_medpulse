import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Lock } from 'lucide-react';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';
import { authApi } from '../api/auth.api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const toast = useToast();

  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [associatedEmail, setAssociatedEmail] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
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
        setErrorMessage('Password reset token is missing from the link URL.');
        return;
      }

      try {
        const res = await authApi.verifyToken(token, 'PASSWORD_RESET');
        if (res?.valid) {
          setTokenValid(true);
          setAssociatedEmail(res.email || null);
        } else {
          setTokenValid(false);
          setErrorMessage('This password reset link is invalid or has expired.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setErrorMessage(err.message || 'The reset link is invalid or has expired. Please request a new link.');
      } finally {
        setIsValidating(false);
      }
    };

    verify();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await authApi.resetPassword({ token, newPassword });
      setIsSuccess(true);
      toast.success('Password Updated', 'Your credentials have been securely updated. You can now log in.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password. The link may have expired.');
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
            Create New Password
          </h1>
          <p className="text-xs text-slate-500">
            Set a new secure password for your clinical and administrative portal account
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
              <p className="text-xs text-slate-500">Verifying secure reset token...</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Invalid or Expired Link</h3>
                <p className="text-xs text-slate-500">
                  Password reset links are single-use and expire within 60 minutes for institutional security.
                </p>
              </div>
              <Link to="/staff/forgot-password" className="block pt-2">
                <Button className="w-full bg-royal-600 hover:bg-royal-700 text-white font-bold">
                  Request New Reset Link
                </Button>
              </Link>
            </div>
          ) : isSuccess ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Password Updated Successfully</h3>
                <p className="text-xs text-slate-500">
                  Your new credentials are now active. You may sign in to your portal dashboard immediately.
                </p>
              </div>
              <Button
                onClick={() => navigate('/staff/login')}
                className="w-full bg-royal-600 hover:bg-royal-700 text-white font-bold"
              >
                Sign In Now <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {associatedEmail && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                  Resetting credentials for: <strong className="text-slate-900">{associatedEmail}</strong>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
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
                  Confirm New Password
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
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
                Update Password & Secure Account <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          <div className="border-t border-slate-100 pt-4 text-center">
            <Link
              to="/staff/login"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              Return to Sign In
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
