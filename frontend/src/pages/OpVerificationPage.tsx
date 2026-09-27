import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ShieldCheck, AlertCircle, Building2, Calendar, Clock, User, ArrowLeft } from 'lucide-react';
import { appointmentsApi } from '../api/appointments.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';

export const OpVerificationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const { data: verification, isLoading, error } = useQuery({
    queryKey: ['verify-op', token],
    queryFn: () => appointmentsApi.verifyOp(token!),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-royal-600 mx-auto"></div>
        <p className="text-sm text-slate-500 mt-4">Verifying Digital OP Token with Medical Registry...</p>
      </div>
    );
  }

  if (error || !verification) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Invalid Verification Token</h2>
        <p className="text-sm text-slate-500">
          This Digital OP QR code is invalid, expired, or does not exist in the Rocket Wheel hospital registry.
        </p>
        <Link to="/" className="inline-block mt-4">
          <Button variant="outline">Go to Rocket Wheel Homepage</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12 space-y-6">
      {/* Official Verification Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <ShieldCheck className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Digital OP Verified
        </h1>
        <p className="text-xs text-slate-500">
          Official verification issued by {verification.hospital}
        </p>
      </div>

      {/* Verification Card with ONLY MINIMAL SAFE INFORMATION */}
      <Card className="rounded-2xl border-2 border-royal-500/30 shadow-lg overflow-hidden">
        <div className="bg-royal-600 text-white p-4 text-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-royal-200">
            OP Identification
          </div>
          <div className="text-xl font-black mt-0.5">{verification.opNumber}</div>
        </div>

        <CardContent className="p-6 space-y-4 text-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">Patient Name:</span>
            <span className="font-bold text-slate-900">{verification.patientName}</span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">Hospital:</span>
            <span className="font-semibold text-slate-900">{verification.hospital}</span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">Consultant Doctor:</span>
            <span className="font-semibold text-slate-900">{verification.doctor}</span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">Scheduled Date:</span>
            <span className="font-semibold text-slate-900">{verification.appointmentDate}</span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">Time Slot:</span>
            <span className="font-semibold text-slate-900">{verification.timeSlot}</span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">Queue Token:</span>
            <Badge variant="purple" className="font-bold bg-pink-100 text-pink-700 border-pink-200">
              Token #{verification.tokenNumber}
            </Badge>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">Payment Status:</span>
            <Badge variant="success" className="font-bold">
              {verification.paymentStatus}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Appointment Status:</span>
            <Badge variant="info" className="font-bold">
              {verification.appointmentStatus}
            </Badge>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
            Verified via Rocket Wheel Cryptographic QR Registry • {new Date(verification.verifiedAt).toLocaleTimeString()} IST
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Link to="/">
          <Button variant="ghost" size="sm" className="text-slate-500">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};
