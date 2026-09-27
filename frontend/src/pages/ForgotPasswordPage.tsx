import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';
import { authApi } from '../api/auth.api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';

export const ForgotPasswordPage: React.FC = () => {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Please enter your official email address');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await authApi.forgotPassword(email);
      setIsSubmitted(true);
      if (res?.resetLink) {
        setDevResetLink(res.resetLink);
      }
      toast.success('Instructions Sent', 'If an account exists with this email, reset instructions were dispatched.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to process request at this time. Please try again.');
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
            Reset Portal Password
          </h1>
          <p className="text-xs text-slate-500">
            Enter your official institutional email to receive secure recovery instructions
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <Card className="rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl border-slate-200">
          {!isSubmitted ? (
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
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-royal-600 hover:bg-royal-700 text-white font-bold shadow-md shadow-royal-600/20"
                isLoading={isLoading}
              >
                Send Reset Instructions <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          ) : (
            <div className="space-y-5 text-center py-2">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">Check Your Inbox</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If an active account is associated with <strong>{email}</strong>, a password reset link valid for 60 minutes has been dispatched.
                </p>
              </div>

              {devResetLink && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-left space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Evaluation / Test Shortcut:</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    In development mode, you can immediately test the reset token:
                  </p>
                  <Link
                    to={devResetLink}
                    className="inline-flex items-center justify-center w-full py-2 px-3 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
                  >
                    Proceed to Reset Password Page →
                  </Link>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setIsSubmitted(false);
                  setDevResetLink(null);
                }}
              >
                Request Again with Another Email
              </Button>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 text-center">
            <Link
              to="/staff/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-royal-600 hover:text-royal-800 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Staff Sign In
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
