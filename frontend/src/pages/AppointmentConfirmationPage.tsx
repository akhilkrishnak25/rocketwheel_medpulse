import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2,
  Download,
  Printer,
  ShieldCheck,
  Activity,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { appointmentsApi } from '../api/appointments.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export const AppointmentConfirmationPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => appointmentsApi.getById(appointmentId!),
    enabled: !!appointmentId,
  });

  const { data: queue, refetch: refetchQueue } = useQuery({
    queryKey: ['queue-status', appointmentId],
    queryFn: () => appointmentsApi.getQueueStatus(appointmentId!),
    enabled: !!appointmentId,
    refetchInterval: 15000,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-royal-600 mx-auto"></div>
        <p className="text-sm text-slate-500 mt-4">Generating your Digital OP Slip...</p>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="max-w-md mx-auto py-20 text-center px-4">
        <h2 className="text-xl font-bold text-slate-900">Appointment Not Found</h2>
        <Link to="/hospitals" className="mt-4 inline-block">
          <Button variant="primary">Return Home</Button>
        </Link>
      </div>
    );
  }

  const opNumber = appointment.digitalOp?.opNumber || 'OP-PROCESSING';
  const secureToken = appointment.digitalOp?.secureToken || '';
  const verificationUrl = `${window.location.origin}/verify-op/${secureToken}`;
  const pdfDownloadUrl = appointmentsApi.getPdfUrl(appointment.id);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* SUCCESS CONFIRMATION BANNER */}
      <div className="text-center space-y-3 print:hidden">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-sm">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>
        <Badge variant="gold" className="text-xs font-black uppercase tracking-wider px-3 py-1">
          Payment Confirmed • Appointment Verified
        </Badge>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Appointment Confirmed!
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Your hospital outpatient appointment is booked. Your Digital OP Slip has been created with queue token #{appointment.tokenNumber}.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-3 max-w-md mx-auto sm:max-w-none">
          <a href={pdfDownloadUrl} download={`Digital_OP_${opNumber}.pdf`} className="w-full sm:w-auto">
            <Button size="md" className="w-full bg-[#FF1D6B] hover:bg-[#e1145a] !text-white text-white font-extrabold shadow-md py-3">
              <Download className="w-4 h-4 mr-2 text-white" /> Download Digital OP (PDF)
            </Button>
          </a>
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
              `🏥 My Doctor Appointment OP Slip:\n• Hospital: ${appointment.hospital?.name}\n• Doctor: ${appointment.doctor?.name}\n• Date: ${appointment.appointmentDate} at ${appointment.timeSlot}\n• Queue Token: #${appointment.tokenNumber}\n• OP Number: ${opNumber}\n• Verify QR: ${verificationUrl}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto"
          >
            <Button variant="outline" size="md" className="w-full font-bold border-emerald-500 text-emerald-700 hover:bg-emerald-50 py-3">
              <Share2 className="w-4 h-4 mr-2 text-emerald-600" /> Share via WhatsApp
            </Button>
          </a>
          <Button variant="outline" size="md" onClick={handlePrint} className="hidden sm:inline-flex font-bold">
            <Printer className="w-4 h-4 mr-2" /> Print OP Slip
          </Button>
        </div>
      </div>

      {/* LIVE QUEUE STATUS CARD */}
      <div className="bg-[#1E20E0] text-white rounded-3xl p-6 shadow-xl space-y-4 print:hidden border border-royal-700">
        <div className="flex items-center justify-between border-b border-royal-400/40 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#FBA94C]" />
            <h3 className="font-black text-sm text-white">Live OPD Queue Tracking</h3>
          </div>
          <button
            onClick={() => refetchQueue()}
            className="text-xs text-blue-200 hover:text-white flex items-center gap-1 transition-colors font-semibold"
          >
            <RefreshCw className="w-3 h-3" /> Refresh Queue
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-[#15179f] p-4 rounded-2xl border border-royal-400/30">
            <div className="text-[11px] text-blue-200 font-bold uppercase">Your Token</div>
            <div className="text-3xl font-black text-[#FBA94C] mt-1">
              {String(appointment.tokenNumber).padStart(2, '0')}
            </div>
          </div>

          <div className="bg-[#15179f] p-4 rounded-2xl border border-royal-400/30">
            <div className="text-[11px] text-blue-200 font-bold uppercase">Now Consulting</div>
            <div className="text-3xl font-black text-white mt-1">
              {queue?.currentToken ? String(queue.currentToken).padStart(2, '0') : '--'}
            </div>
          </div>

          <div className="bg-[#15179f] p-4 rounded-2xl border border-royal-400/30">
            <div className="text-[11px] text-blue-200 font-bold uppercase">Patients Ahead</div>
            <div className="text-3xl font-black text-[#FF1D6B] mt-1">
              {queue !== undefined ? queue.patientsAhead : '--'}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-blue-200 text-center">
          Doctor: <strong className="text-white">{appointment.doctor?.name}</strong> • Status:{' '}
          <span className="text-[#FBA94C] font-bold">{appointment.status}</span>
        </p>
      </div>

      {/* PRINTABLE DIGITAL OP SLIP CARD */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-xl overflow-hidden print:border-none print:shadow-none">
        {/* Hospital Header in Royal Blue */}
        <div className="bg-[#1E20E0] text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase font-extrabold tracking-widest text-[#FBA94C]">
              Official Outpatient (OP) Slip • Rocket Wheel Platform
            </div>
            <h2 className="text-2xl font-black">{appointment.hospital?.name}</h2>
            <p className="text-xs text-blue-100">
              {appointment.hospital?.address}, {appointment.hospital?.city}
            </p>
            <p className="text-xs text-blue-200">
              Phone: {appointment.hospital?.phone} | Emergency: {appointment.hospital?.emergencyContact}
            </p>
          </div>

          <div className="bg-[#FBA94C] text-slate-950 px-5 py-3 rounded-2xl text-center shrink-0 shadow-md">
            <div className="text-[10px] uppercase font-black tracking-wider">Queue Token</div>
            <div className="text-3xl font-black">
              #{String(appointment.tokenNumber).padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Key Appointment Bar */}
        <div className="bg-slate-100 px-6 sm:px-8 py-3.5 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 font-medium block">OP Number:</span>
            <span className="font-mono font-bold text-royal-700">{opNumber}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">Appointment ID:</span>
            <span className="font-bold text-slate-900">{appointment.appointmentNumber}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">Date:</span>
            <span className="font-bold text-slate-900">{appointment.appointmentDate}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">Time Slot:</span>
            <span className="font-bold text-slate-900">{appointment.timeSlot}</span>
          </div>
        </div>

        {/* Content Details */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-royal-600">
                Patient Information
              </h4>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-bold text-slate-900">{appointment.patient.fullName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Mobile:</span>
                <span className="font-medium text-slate-900">+91 {appointment.patient.mobileNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Email:</span>
                <span className="font-medium text-slate-900">{appointment.patient.email}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Blood Group:</span>
                <span className="font-bold text-slate-900">{appointment.patient.bloodGroup || 'N/A'}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-royal-600">
                Consultant Doctor
              </h4>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Doctor:</span>
                <span className="font-bold text-slate-900">{appointment.doctor.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Specialization:</span>
                <span className="font-medium text-slate-900">{appointment.doctor.specialization}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Department:</span>
                <span className="font-medium text-slate-900">{appointment.department.name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Room / OPD:</span>
                <span className="font-bold text-slate-900">Main OPD Block - 2nd Floor</span>
              </div>
            </div>
          </div>

          {/* Payment & QR Code Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl bg-royal-50/50 border border-royal-200 gap-6">
            <div className="space-y-1.5 text-xs">
              <div className="text-emerald-700 font-bold flex items-center gap-1.5 text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Payment Status: SUCCESS
              </div>
              <p className="text-slate-600">
                Total Paid: <strong>₹{appointment.totalAmount.toFixed(2)}</strong> (Consultation: ₹
                {appointment.consultationFee} + Platform Fee: ₹{appointment.platformFee})
              </p>
              <p className="text-slate-500 text-[11px]">
                Payment Ref: {appointment.payment?.razorpayPaymentId || 'ONLINE_VERIFIED'}
              </p>
            </div>

            {/* QR Code */}
            <div className="text-center shrink-0">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 inline-block">
                <QRCodeSVG value={verificationUrl} size={90} level="M" fgColor="#1E20E0" />
              </div>
              <span className="block text-[10px] font-black text-royal-700 mt-1 uppercase tracking-wider">
                Scan to Verify OP
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-2 text-xs text-slate-600">
            <h5 className="font-bold text-slate-900">Hospital Instructions:</h5>
            <ul className="list-disc pl-5 space-y-1">
              <li>Arrive 15 minutes prior to scheduled slot at the hospital OPD reception.</li>
              <li>Present this Digital OP Slip on your mobile or as a printout.</li>
              <li>Carry valid government photo ID and previous relevant medical history or lab records.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
