import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Phone,
  KeyRound,
  Download,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { otpApi } from '../api/otp.api';
import { appointmentsApi } from '../api/appointments.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { Appointment } from '../types';

export const AppointmentLookupPage: React.FC = () => {
  const toast = useToast();

  const [step, setStep] = useState<'ENTER_DETAILS' | 'ENTER_OTP' | 'VIEW_APPOINTMENT'>('ENTER_DETAILS');
  const [appointmentIdInput, setAppointmentIdInput] = useState('');
  const [mobileNumberInput, setMobileNumberInput] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [demoOtpNotice, setDemoOtpNotice] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retrievedAppointment, setRetrievedAppointment] = useState<Appointment | null>(null);

  // Step 1: Send OTP to patient's registered phone
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentIdInput.trim() || !mobileNumberInput.trim()) {
      setErrorMessage('Please enter both your Appointment/OP Number and Mobile Number.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await otpApi.sendOtp(appointmentIdInput.trim(), mobileNumberInput.trim());
      toast.success('OTP Dispatched', res.message);
      if (res.demoOtp) {
        setDemoOtpNotice(res.demoOtp);
        setOtpCodeInput(res.demoOtp); // Autofill demo OTP for quick testing
      }
      setStep('ENTER_OTP');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to find appointment or send OTP');
      toast.error('Lookup Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCodeInput.trim() || otpCodeInput.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit OTP code received.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const appointment = await otpApi.verifyOtp(
        appointmentIdInput.trim(),
        mobileNumberInput.trim(),
        otpCodeInput.trim()
      );
      setRetrievedAppointment(appointment);
      setStep('VIEW_APPOINTMENT');
      toast.success('Verified!', 'Appointment and OP slip retrieved successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP. Please try again.');
      toast.error('Verification Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('ENTER_DETAILS');
    setAppointmentIdInput('');
    setMobileNumberInput('');
    setOtpCodeInput('');
    setDemoOtpNotice(null);
    setErrorMessage(null);
    setRetrievedAppointment(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-royal-100 flex items-center justify-center text-royal-700 mx-auto mb-2">
          <FileText className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Patient Appointment Lookup
        </h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          No account or login required. Enter your Appointment ID and mobile number to receive a secure one-time OTP.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      {/* STEP 1: ENTER APPOINTMENT ID & MOBILE */}
      {step === 'ENTER_DETAILS' && (
        <Card className="rounded-2xl p-6 sm:p-8 space-y-6">
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Appointment ID or OP Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={appointmentIdInput}
                onChange={(e) => setAppointmentIdInput(e.target.value)}
                placeholder="e.g. APT-2026-0926-001 or OP-2026-0926-000101"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Provided on your payment confirmation screen or SMS confirmation
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registered Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={mobileNumberInput}
                  onChange={(e) => setMobileNumberInput(e.target.value)}
                  placeholder="9845012345"
                  className="w-full text-sm pl-12 pr-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-royal-600 hover:bg-royal-700 font-bold py-3"
              isLoading={isLoading}
            >
              Send Verification OTP <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Patient Lookup Instructions */}
          <div className="p-3.5 bg-royal-50/50 rounded-xl border border-royal-100 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-royal-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-royal-600" />
              Secure Outpatient Verification
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Enter the Appointment ID from your booking confirmation or the OP Number printed on your digital slip, along with your 10-digit mobile number.
            </p>
          </div>
        </Card>
      )}

      {/* STEP 2: ENTER OTP */}
      {step === 'ENTER_OTP' && (
        <Card className="rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h3 className="font-bold text-slate-900 text-lg">Enter 6-Digit OTP</h3>
            <p className="text-xs text-slate-500">
              We sent a verification code to +91 ******{mobileNumberInput.slice(-4)}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>OTP sent to your registered phone. Valid for 5 minutes.</span>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCodeInput}
                onChange={(e) => setOtpCodeInput(e.target.value)}
                placeholder="123456"
                className="w-full text-center tracking-[0.5em] text-2xl font-black px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-pink-600 hover:bg-pink-700 font-bold"
              isLoading={isLoading}
            >
              Verify OTP & View Appointment
            </Button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              Change Appointment ID or Mobile Number
            </button>
          </form>
        </Card>
      )}

      {/* STEP 3: DISPLAY APPOINTMENT DETAILS & DIGITAL OP */}
      {step === 'VIEW_APPOINTMENT' && retrievedAppointment && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Appointment Found</h2>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> New Lookup
            </Button>
          </div>

          <Card className="rounded-2xl border-2 border-royal-600/40 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-royal-700 text-white p-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-royal-200">
                  Digital OP Slip
                </div>
                <h3 className="font-extrabold text-lg">
                  {retrievedAppointment.digitalOp?.opNumber || 'OP CONFIRMED'}
                </h3>
                <p className="text-xs text-royal-100">{retrievedAppointment.hospital?.name}</p>
              </div>

              <div className="text-center bg-white/10 px-4 py-2 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-gold-300">Token</div>
                <div className="text-2xl font-black text-gold-400">
                  #{retrievedAppointment.tokenNumber}
                </div>
              </div>
            </div>

            {/* Details */}
            <CardContent className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-slate-500 block">Patient:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {retrievedAppointment.patient.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Doctor:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {retrievedAppointment.doctor.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Date:</span>
                  <span className="font-semibold text-slate-900">
                    {retrievedAppointment.appointmentDate}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Time Slot:</span>
                  <span className="font-semibold text-slate-900">
                    {retrievedAppointment.timeSlot}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Payment Status:</span>
                  <Badge variant="success" className="font-bold">
                    {retrievedAppointment.payment?.status || 'SUCCESS'}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500 block">Appointment Status:</span>
                  <Badge variant="info" className="font-bold">
                    {retrievedAppointment.status}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <a
                  href={appointmentsApi.getPdfUrl(retrievedAppointment.id)}
                  download={`Digital_OP_${retrievedAppointment.digitalOp?.opNumber}.pdf`}
                  className="flex-1"
                >
                  <Button size="md" className="w-full bg-royal-600 hover:bg-royal-700 font-bold">
                    <Download className="w-4 h-4 mr-2" /> Download Digital OP (PDF)
                  </Button>
                </a>
                <Link to={`/appointments/${retrievedAppointment.id}/confirmed`}>
                  <Button variant="outline" size="md">
                    View Full Slip & Queue
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
