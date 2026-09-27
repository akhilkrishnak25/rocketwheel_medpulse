import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stethoscope,
  Users,
  Play,
  CheckCircle2,
  FileText,
  Pill,
  Clock,
  Activity,
  Plus,
  Trash2,
  ShieldCheck,
  User,
  Heart,
} from 'lucide-react';
import { doctorDashboardApi } from '../api/doctor.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { Appointment } from '../types';

interface MedicineItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export const DoctorDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'queue' | 'roster' | 'leaves'>('queue');

  // Consultation Clinical Data Form State
  const [diagnosis, setDiagnosis] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [vitals, setVitals] = useState({
    bp: '120/80 mmHg',
    pulse: '76 bpm',
    temperature: '98.4 F',
    weight: '65 kg',
    spo2: '99%',
  });
  const [medicines, setMedicines] = useState<MedicineItem[]>([
    {
      name: 'Tab Paracetamol 650mg',
      dosage: '1 tablet',
      frequency: 'TDS (Thrice daily)',
      duration: '5 days',
      instructions: 'After food',
    },
  ]);

  // Leave Management State
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // Fetch today's appointments for this doctor
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => doctorDashboardApi.getAppointments(),
    refetchInterval: 8000,
  });

  // Doctor profile query
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['doctor-profile'],
    queryFn: () => doctorDashboardApi.getProfile(),
  });

  // Doctor leaves query
  const { data: leaves, refetch: refetchLeaves } = useQuery({
    queryKey: ['doctor-leaves'],
    queryFn: () => doctorDashboardApi.getLeaves(),
    enabled: activeTab === 'leaves',
  });

  // Start consultation mutation
  const startMutation = useMutation({
    mutationFn: (appointmentId: string) => doctorDashboardApi.startConsultation(appointmentId),
    onSuccess: (data) => {
      toast.success('Consultation Started', `Now consulting patient: ${data.patient?.fullName}`);
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    },
  });

  // Complete consultation mutation
  const completeMutation = useMutation({
    mutationFn: (data: any) =>
      doctorDashboardApi.completeConsultation(data.appointmentId, data.payload),
    onSuccess: () => {
      toast.success('Consultation Completed!', 'Prescription & diagnosis recorded');
      setIsConsultModalOpen(false);
      setActiveAppointment(null);
      resetConsultationForm();
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    },
    onError: (err: any) => {
      toast.error('Failed to complete consultation', err.message);
    },
  });

  // Apply leave mutation
  const applyLeaveMutation = useMutation({
    mutationFn: (data: any) => doctorDashboardApi.applyLeave(data),
    onSuccess: () => {
      toast.success('Leave Applied', 'Your leave request has been submitted');
      setIsApplyLeaveOpen(false);
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
      queryClient.invalidateQueries({ queryKey: ['doctor-leaves'] });
    },
    onError: (err: any) => {
      toast.error('Failed to Apply Leave', err.message);
    },
  });

  // Cancel leave mutation
  const cancelLeaveMutation = useMutation({
    mutationFn: (leaveId: string) => doctorDashboardApi.cancelLeave(leaveId),
    onSuccess: () => {
      toast.success('Leave Cancelled', 'Leave record has been removed');
      queryClient.invalidateQueries({ queryKey: ['doctor-leaves'] });
    },
    onError: (err: any) => {
      toast.error('Failed to Cancel Leave', err.message);
    },
  });

  // Update profile / roster mutation
  const updateRosterMutation = useMutation({
    mutationFn: (data: any) => doctorDashboardApi.updateProfile(data),
    onSuccess: () => {
      toast.success('Schedule Updated', 'Consultation hours and working days updated successfully');
      queryClient.invalidateQueries({ queryKey: ['doctor-profile'] });
    },
    onError: (err: any) => {
      toast.error('Failed to Update Schedule', err.message);
    },
  });

  const resetConsultationForm = () => {
    setDiagnosis('');
    setSymptoms('');
    setClinicalNotes('');
    setFollowUpDate('');
    setMedicines([
      {
        name: '',
        dosage: '1 tab',
        frequency: 'BD (Twice daily)',
        duration: '5 days',
        instructions: 'After food',
      },
    ]);
  };

  const addMedicine = () => {
    setMedicines([
      ...medicines,
      {
        name: '',
        dosage: '1 tablet',
        frequency: 'BD (Twice daily)',
        duration: '5 days',
        instructions: 'After meals',
      },
    ]);
  };

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const updateMedicine = (index: number, field: keyof MedicineItem, val: string) => {
    const next = [...medicines];
    next[index][field] = val;
    setMedicines(next);
  };

  const handleOpenConsultModal = (apt: Appointment) => {
    setActiveAppointment(apt);
    setIsConsultModalOpen(true);
  };

  // Find currently consulting patient
  const inConsultationPatient = (appointments || []).find(
    (a) => a.status === 'IN_CONSULTATION'
  );

  return (
    <div className="space-y-8">
      {/* Title & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Doctor OPD Consultation Room
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your daily patient queue, start consultations, and issue digital prescriptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar whitespace-nowrap">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                activeTab === 'queue' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today's Queue ({(appointments || []).length})
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                activeTab === 'roster' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Roster & Hours
            </button>
            <button
              onClick={() => setActiveTab('leaves')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                activeTab === 'leaves' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Leave Management
            </button>
          </div>
          {activeTab === 'queue' && (
            <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0 text-xs">
              Refresh Queue
            </Button>
          )}
        </div>
      </div>

      {/* TAB 1: OPD QUEUE */}
      {activeTab === 'queue' && (
        <>

      {/* ACTIVE CONSULTATION HERO BOX */}
      {inConsultationPatient ? (
        <Card className="rounded-2xl border-2 border-royal-600 bg-royal-50/40 p-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <Badge variant="purple" className="font-bold text-xs uppercase tracking-wide bg-pink-100 text-pink-700 border-pink-200">
                Currently In Consultation
              </Badge>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-slate-900">
                  Token #{String(inConsultationPatient.tokenNumber).padStart(2, '0')}
                </span>
                <span className="text-xl font-bold text-slate-800">
                  {inConsultationPatient.patient.fullName}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                <span>Mobile: +91 {inConsultationPatient.patient.mobileNumber}</span>
                <span>•</span>
                <span>Blood Group: {inConsultationPatient.patient.bloodGroup || 'N/A'}</span>
                <span>•</span>
                <span>OP Number: {inConsultationPatient.digitalOp?.opNumber}</span>
              </div>
              {inConsultationPatient.notes && (
                <p className="text-xs text-slate-500 italic bg-white p-2.5 rounded-xl border border-royal-200">
                  Symptoms: {inConsultationPatient.notes}
                </p>
              )}
            </div>

            <Button
              size="lg"
              className="bg-royal-600 hover:bg-royal-700 font-bold shadow-md shrink-0 shadow-royal-600/20"
              onClick={() => handleOpenConsultModal(inConsultationPatient)}
            >
              <FileText className="w-5 h-5 mr-2" /> Write Rx & Complete Consultation
            </Button>
          </div>
        </Card>
      ) : (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
          <Stethoscope className="w-10 h-10 text-royal-600 mx-auto" />
          <h3 className="font-bold text-slate-900 text-sm">No Active Patient In Consultation</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Select the next arrived patient from your queue below and click "Start Consultation".
          </p>
        </div>
      )}

      {/* TODAY'S OPD QUEUE */}
      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/80 p-5 flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-royal-600" />
            Today's OPD Queue ({(appointments || []).length} Total Booked)
          </CardTitle>
          <div className="flex gap-2 text-xs font-semibold">
            <span className="text-royal-700">
              {(appointments || []).filter((a) => a.status === 'COMPLETED').length} Completed
            </span>
            <span>•</span>
            <span className="text-gold-600">
              {(appointments || []).filter((a) => a.status === 'WAITING' || a.status === 'CONFIRMED').length} Waiting
            </span>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Token</th>
                <th className="px-5 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Slot Time</th>
                <th className="px-5 py-3.5">OP Number</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">OPD Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Loading doctor queue...
                  </td>
                </tr>
              ) : !appointments || appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No appointments booked for today.
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-black text-slate-900 text-base">
                      #{String(apt.tokenNumber).padStart(2, '0')}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{apt.patient.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        +91 {apt.patient.mobileNumber} • {apt.patient.bloodGroup || 'Blood: N/A'}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{apt.timeSlot}</td>
                    <td className="px-5 py-4 font-mono font-bold text-royal-800">
                      {apt.digitalOp?.opNumber || 'N/A'}
                    </td>
                    <td className="px-5 py-4">
                      {apt.status === 'CONFIRMED' && <Badge variant="info">CONFIRMED</Badge>}
                      {apt.status === 'WAITING' && <Badge variant="warning">WAITING IN OPD</Badge>}
                      {apt.status === 'IN_CONSULTATION' && (
                        <Badge variant="purple" className="bg-pink-100 text-pink-700 border-pink-200">IN CONSULTATION</Badge>
                      )}
                      {apt.status === 'COMPLETED' && <Badge variant="success">COMPLETED</Badge>}
                      {apt.status === 'CANCELLED' && <Badge variant="danger">CANCELLED</Badge>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {apt.status === 'IN_CONSULTATION' && (
                        <Button
                          size="sm"
                          className="bg-pink-600 hover:bg-pink-700 text-xs font-bold"
                          onClick={() => handleOpenConsultModal(apt)}
                        >
                          Continue Consultation
                        </Button>
                      )}

                      {(apt.status === 'CONFIRMED' || apt.status === 'WAITING') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-royal-700 bg-royal-50 border-royal-200 hover:bg-royal-100 font-bold"
                          onClick={() => startMutation.mutate(apt.id)}
                        >
                          <Play className="w-3.5 h-3.5 mr-1" /> Call Patient
                        </Button>
                      )}

                      {apt.status === 'COMPLETED' && (
                        <span className="text-emerald-700 font-semibold text-xs flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Rx Issued
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
        </>
      )}

      {/* TAB 2: ROSTER & SCHEDULE */}
      {activeTab === 'roster' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">OPD Consultation Hours & Settings</h2>
            <p className="text-xs text-slate-500">
              Configure your daily clinic timing, working days, and consultation fee
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const fee = (form.elements.namedItem('fee') as HTMLInputElement).value;
              const days = (form.elements.namedItem('days') as HTMLInputElement).value;
              const start = (form.elements.namedItem('start') as HTMLInputElement).value;
              const end = (form.elements.namedItem('end') as HTMLInputElement).value;
              const about = (form.elements.namedItem('about') as HTMLTextAreaElement).value;
              const languages = (form.elements.namedItem('languages') as HTMLInputElement).value;

              updateRosterMutation.mutate({
                consultationFee: Number(fee),
                workingDays: days,
                workingHoursStart: start,
                workingHoursEnd: end,
                about,
                languages,
              });
            }}
            className="space-y-4 text-xs max-w-2xl"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Consultation Fee (₹)
                </label>
                <input
                  type="number"
                  name="fee"
                  defaultValue={profile?.consultationFee || 500}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Working Days (Comma-separated)
                </label>
                <input
                  type="text"
                  name="days"
                  defaultValue={profile?.workingDays || 'Mon,Tue,Wed,Thu,Fri,Sat'}
                  placeholder="Mon,Tue,Wed,Thu,Fri,Sat"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Consultation Start Time (HH:MM)
                </label>
                <input
                  type="text"
                  name="start"
                  defaultValue={profile?.workingHoursStart || '09:00'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Consultation End Time (HH:MM)
                </label>
                <input
                  type="text"
                  name="end"
                  defaultValue={profile?.workingHoursEnd || '17:00'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Languages Spoken
              </label>
              <input
                type="text"
                name="languages"
                defaultValue={profile?.languages || 'English, Hindi'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Professional Bio / Clinical Focus
              </label>
              <textarea
                name="about"
                rows={3}
                defaultValue={profile?.about || ''}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="md"
                className="bg-royal-600 hover:bg-royal-700 font-bold"
                disabled={updateRosterMutation.isPending}
              >
                {updateRosterMutation.isPending ? 'Updating...' : 'Save Consultation Settings'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 3: LEAVES & ABSENCES */}
      {activeTab === 'leaves' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Leave Requests & Absences</h2>
              <p className="text-xs text-slate-500">
                Scheduled doctor leaves automatically block patient appointment bookings for those dates
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsApplyLeaveOpen(true)}
              className="bg-royal-600 hover:bg-royal-700 font-bold"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Apply for Leave
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Start Date</th>
                  <th className="px-5 py-3.5">End Date</th>
                  <th className="px-5 py-3.5">Reason / Medical Conference</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {leaves && leaves.length > 0 ? (
                  leaves.map((leave: any) => (
                    <tr key={leave.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {new Date(leave.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {new Date(leave.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{leave.reason || 'Personal Leave'}</td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:bg-rose-50 text-xs"
                          onClick={() => {
                            if (window.confirm('Cancel this leave request?')) {
                              cancelLeaveMutation.mutate(leave.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Cancel Leave
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-400">
                      No scheduled leaves on record. Click 'Apply for Leave' to register time off.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* APPLY LEAVE MODAL */}
      {isApplyLeaveOpen && (
        <Modal
          isOpen={isApplyLeaveOpen}
          onClose={() => setIsApplyLeaveOpen(false)}
          title="Apply for Doctor Leave"
          maxWidth="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!leaveStart || !leaveEnd) {
                toast.error('Validation Error', 'Please select both start and end dates.');
                return;
              }
              applyLeaveMutation.mutate({
                startDate: leaveStart,
                endDate: leaveEnd,
                reason: leaveReason.trim() || 'Clinical conference / Personal leave',
              });
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Leave Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={leaveStart}
                onChange={(e) => setLeaveStart(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Leave End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={leaveEnd}
                onChange={(e) => setLeaveEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason (Optional)</label>
              <input
                type="text"
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="e.g. Annual Medical Conference / Vacation"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsApplyLeaveOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-royal-600 hover:bg-royal-700 font-bold"
                disabled={applyLeaveMutation.isPending}
              >
                {applyLeaveMutation.isPending ? 'Submitting...' : 'Submit Leave'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* COMPLETE CONSULTATION & PRESCRIPTION MODAL */}
      {isConsultModalOpen && activeAppointment && (
        <Modal
          isOpen={isConsultModalOpen}
          onClose={() => setIsConsultModalOpen(false)}
          title={`Clinical Consultation - ${activeAppointment.patient.fullName} (Token #${activeAppointment.tokenNumber})`}
          maxWidth="2xl"
        >
          <div className="space-y-6 text-xs">
            {/* Vitals Bar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700 block mb-2">Patient Vitals:</span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">Blood Pressure</span>
                  <input
                    type="text"
                    value={vitals.bp}
                    onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Pulse Rate</span>
                  <input
                    type="text"
                    value={vitals.pulse}
                    onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Temperature</span>
                  <input
                    type="text"
                    value={vitals.temperature}
                    onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Weight</span>
                  <input
                    type="text"
                    value={vitals.weight}
                    onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SpO2</span>
                  <input
                    type="text"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Diagnosis (Required) */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Clinical Diagnosis <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute Bronchitis / Essential Hypertension"
                className="w-full text-sm font-semibold p-2.5 rounded-xl border border-slate-200 focus:ring-royal-500"
                required
              />
            </div>

            {/* Prescription Medicines Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-pink-500" />
                  Prescribed Medicines
                </label>
                <Button variant="outline" size="sm" onClick={addMedicine} className="text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Medicine
                </Button>
              </div>

              {medicines.map((med, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 items-end"
                >
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-400 block">Medicine & Strength</span>
                    <input
                      type="text"
                      value={med.name}
                      onChange={(e) => updateMedicine(idx, 'name', e.target.value)}
                      placeholder="e.g. Tab Amoxicillin 500mg"
                      className="w-full text-xs p-1.5 rounded border border-slate-200"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Frequency</span>
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => updateMedicine(idx, 'frequency', e.target.value)}
                      placeholder="e.g. BD (Twice daily)"
                      className="w-full text-xs p-1.5 rounded border border-slate-200"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Duration</span>
                    <input
                      type="text"
                      value={med.duration}
                      onChange={(e) => updateMedicine(idx, 'duration', e.target.value)}
                      placeholder="e.g. 5 days"
                      className="w-full text-xs p-1.5 rounded border border-slate-200"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={med.instructions}
                      onChange={(e) => updateMedicine(idx, 'instructions', e.target.value)}
                      placeholder="After food"
                      className="w-full text-xs p-1.5 rounded border border-slate-200"
                    />
                    {medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicine(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Clinical Notes & Follow-up */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Clinical Notes & Lifestyle Advice
                </label>
                <textarea
                  rows={2}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Advised plenty of fluids, low salt diet, rest..."
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Follow-up Review Date
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setIsConsultModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="md"
                className="bg-royal-600 hover:bg-royal-700 font-bold"
                isLoading={completeMutation.isPending}
                onClick={() => {
                  if (!diagnosis.trim()) {
                    toast.error('Diagnosis Required', 'Please enter a diagnosis');
                    return;
                  }

                  completeMutation.mutate({
                    appointmentId: activeAppointment.id,
                    payload: {
                      diagnosis,
                      symptoms,
                      clinicalNotes,
                      followUpDate,
                      vitals,
                      medicines,
                    },
                  });
                }}
              >
                Complete & Issue Prescription
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
