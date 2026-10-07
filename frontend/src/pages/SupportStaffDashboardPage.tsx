import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Heart,
  Search,
  CheckCircle2,
  Clock,
  User,
  Stethoscope,
  Filter,
  Check,
  Calendar,
  AlertCircle,
  LogOut,
  Users,
} from 'lucide-react';
import { supportStaffApi } from '../api/supportStaff.api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { Appointment } from '../types';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const SupportStaffDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);

  // Vitals Form State
  // Vitals Form State (Start empty - never hardcode fake/random vitals)
  const [bpSystolic, setBpSystolic] = useState<number | ''>('');
  const [bpDiastolic, setBpDiastolic] = useState<number | ''>('');
  const [pulseRate, setPulseRate] = useState<number | ''>('');
  const [temperature, setTemperature] = useState<number | ''>('');
  const [spo2, setSpo2] = useState<number | ''>('');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [nursingNotes, setNursingNotes] = useState('');

  // Queue query
  const { data: queue, isLoading, refetch } = useQuery({
    queryKey: ['support-staff-queue'],
    queryFn: () => supportStaffApi.getQueue(),
    refetchInterval: 10000,
  });

  // Immediate popup/toast notifications when new OPD patients arrive in queue (Requirement 13)
  const prevQueueIdsRef = useRef<Set<string>>(new Set());
  const isInitialQueueMount = useRef(true);

  useEffect(() => {
    if (!queue || !Array.isArray(queue)) return;
    if (isInitialQueueMount.current) {
      prevQueueIdsRef.current = new Set(queue.map((q: any) => q.id));
      isInitialQueueMount.current = false;
      return;
    }

    for (const apt of queue) {
      if (!prevQueueIdsRef.current.has(apt.id)) {
        prevQueueIdsRef.current.add(apt.id);
        toast.info(
          'New OPD Patient Arrived',
          `${apt.patient?.fullName || 'Patient'} (Token #${apt.tokenNumber || '—'}) ready for vitals check`
        );
      }
    }
  }, [queue, toast]);

  // Record vitals mutation
  const recordVitalsMutation = useMutation({
    mutationFn: (data: any) => supportStaffApi.recordVitals(data),
    onSuccess: () => {
      toast.success('Vitals Saved', 'Patient clinical vitals logged and patient status advanced to Waiting for Doctor');
      setIsVitalsModalOpen(false);
      setSelectedAppointment(null);
      resetVitalsForm();
      queryClient.invalidateQueries({ queryKey: ['support-staff-queue'] });
    },
    onError: (err: any) => {
      toast.error('Failed to Record Vitals', err.message);
    },
  });

  const resetVitalsForm = () => {
    setBpSystolic('');
    setBpDiastolic('');
    setPulseRate('');
    setTemperature('');
    setSpo2('');
    setWeightKg('');
    setHeightCm('');
    setNursingNotes('');
  };

  const handleOpenVitalsModal = (apt: any) => {
    setSelectedAppointment(apt);
    const existing = apt.vitals?.[0] || apt.vital;
    if (existing) {
      setBpSystolic(existing.bpSystolic !== null && existing.bpSystolic !== undefined ? existing.bpSystolic : '');
      setBpDiastolic(existing.bpDiastolic !== null && existing.bpDiastolic !== undefined ? existing.bpDiastolic : '');
      setPulseRate(existing.pulseRate !== null && existing.pulseRate !== undefined ? existing.pulseRate : '');
      setTemperature(existing.temperature !== null && existing.temperature !== undefined ? existing.temperature : '');
      setSpo2(existing.spo2 !== null && existing.spo2 !== undefined ? existing.spo2 : '');
      setWeightKg(existing.weight !== null && existing.weight !== undefined ? existing.weight : '');
      setHeightCm(existing.height !== null && existing.height !== undefined ? existing.height : '');
      setNursingNotes(existing.notes || '');
    } else {
      resetVitalsForm();
    }
    setIsVitalsModalOpen(true);
  };

  // BMI calculation
  const computedBmi =
    weightKg && heightCm && Number(heightCm) > 0
      ? (Number(weightKg) / Math.pow(Number(heightCm) / 100, 2)).toFixed(1)
      : null;

  const filteredQueue = (queue || []).filter((apt: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      apt.patient?.fullName?.toLowerCase().includes(q) ||
      apt.patient?.mobileNumber?.toLowerCase().includes(q) ||
      apt.tokenNumber?.toString().toLowerCase().includes(q) ||
      apt.patient?.patientIdNumber?.toLowerCase().includes(q) ||
      apt.doctor?.name?.toLowerCase().includes(q) ||
      apt.doctor?.specialization?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <RocketWheelLogo size="sm" />
          <div className="border-l border-slate-700 pl-3">
            <span className="text-xs font-bold text-teal-400 block tracking-wider uppercase">
              Support Staff Triage Portal
            </span>
            <span className="text-sm font-extrabold text-white">
              {user?.hospital?.name || 'Hospital Clinical OPD'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:block text-right">
            <div className="font-bold text-slate-200">{user?.name}</div>
            <div className="text-[11px] text-teal-400">Triage & Screening Nurse</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-6 h-6 text-teal-600" />
              Pre-Consultation Vitals Screening Queue
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record baseline physiological vitals (BP, pulse, temp, SpO₂, weight) before doctor consultation
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, MRN, mobile, token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs shrink-0"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Patient Queue Cards */}
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Arrived Patients Awaiting Clinical Screening
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Patients who have reported to the reception / OPD and need vitals screening
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {filteredQueue.length} In Screening Queue
            </Badge>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-center">Token</th>
                  <th className="px-5 py-3">Patient Name</th>
                  <th className="px-5 py-3">MRN / ID</th>
                  <th className="px-5 py-3">Assigned Doctor</th>
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Screening Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      Loading screening queue...
                    </td>
                  </tr>
                ) : filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      All arrived patients have been screened! Queue is up to date.
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((apt: any) => {
                    const vital = apt.vitals?.[0] || apt.vital;
                    const hasVitals = !!vital;
                    const getVitalStatus = (v: any) => {
                      if (!v) return { label: 'Pending', variant: 'warning' as const };
                      const hasBp = !!(v.bloodPressure || (v.bpSystolic && v.bpDiastolic));
                      const hasPulse = !!v.pulseRate;
                      const hasTemp = !!v.temperature;
                      const hasSpo2 = !!v.spo2;
                      const hasWeight = !!v.weight;

                      const count = [hasBp, hasPulse, hasTemp, hasSpo2, hasWeight].filter(Boolean).length;
                      if (count >= 4) {
                        return { label: 'Completed', variant: 'success' as const };
                      } else if (count > 0) {
                        return { label: 'Partially Completed', variant: 'info' as const };
                      }
                      return { label: 'Pending', variant: 'warning' as const };
                    };
                    const statusInfo = getVitalStatus(vital);

                    return (
                      <tr key={apt.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 text-center font-black text-slate-900 text-sm">
                          #{String(apt.tokenNumber).padStart(2, '0')}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900 text-sm">{apt.patient?.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            +91 {apt.patient?.mobileNumber} • {apt.patient?.gender || '--'}, {apt.patient?.age ? `${apt.patient.age} Y` : '--'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-royal-700">
                          {apt.patient?.patientIdNumber || 'PENDING'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-800">Dr. {apt.doctor?.name}</div>
                          <div className="text-[11px] text-slate-400">{apt.doctor?.specialization || 'OPD'}</div>
                          {apt.assignedStaffId || apt.doctor?.assignedStaffId ? (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                              <Check className="w-2.5 h-2.5 text-teal-600" /> Designated for Dr. {apt.doctor?.name}
                            </span>
                          ) : (
                            <span className="inline-block mt-1 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              General Pool
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant={apt.bookingType === 'OFFLINE' ? 'warning' : 'outline'}
                            className="text-[10px]"
                          >
                            {apt.bookingType || 'ONLINE'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={statusInfo.variant} className="text-[10px]">
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            size="sm"
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                            onClick={() => handleOpenVitalsModal(apt)}
                          >
                            <Activity className="w-3.5 h-3.5 mr-1" />
                            {hasVitals ? 'Edit Vitals' : 'Record Vitals'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* RECORD VITALS MODAL */}
      {isVitalsModalOpen && selectedAppointment && (
        <Modal
          isOpen={isVitalsModalOpen}
          onClose={() => setIsVitalsModalOpen(false)}
          title={`Clinical Vitals Screening: ${selectedAppointment.patient?.fullName} (Token #${selectedAppointment.tokenNumber})`}
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              recordVitalsMutation.mutate({
                appointmentId: selectedAppointment.id,
                patientId: selectedAppointment.patient.id,
                bpSystolic: bpSystolic ? Number(bpSystolic) : undefined,
                bpDiastolic: bpDiastolic ? Number(bpDiastolic) : undefined,
                bloodPressure: bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic}` : undefined,
                pulseRate: pulseRate ? Number(pulseRate) : undefined,
                temperature: temperature ? Number(temperature) : undefined,
                spo2: spo2 ? Number(spo2) : undefined,
                weight: weightKg ? Number(weightKg) : undefined,
                height: heightCm ? Number(heightCm) : undefined,
                notes: nursingNotes.trim() || undefined,
              });
            }}
            className="space-y-4 text-xs"
          >
            {/* Patient Header */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between text-slate-600">
              <div>
                <span className="font-bold text-slate-900 block">{selectedAppointment.patient?.fullName}</span>
                <span className="font-mono text-[11px] text-royal-700">MRN: {selectedAppointment.patient?.patientIdNumber || 'PENDING'}</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-slate-800">Dr. {selectedAppointment.doctor?.name}</span>
                <span className="block text-[11px] text-slate-400">Consultation OPD</span>
              </div>
            </div>

            {/* Blood Pressure */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Systolic BP (mmHg) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="120"
                  min={50}
                  max={300}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-teal-500 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Diastolic BP (mmHg) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="80"
                  min={30}
                  max={200}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-teal-500 font-mono font-bold"
                  required
                />
              </div>
            </div>

            {/* Pulse & Temperature */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pulse Rate (bpm)
                </label>
                <input
                  type="number"
                  value={pulseRate}
                  onChange={(e) => setPulseRate(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="76"
                  min={30}
                  max={250}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Temperature (°F)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="98.6"
                  min={85}
                  max={112}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            {/* SpO2 & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Oxygen SpO₂ (%)
                </label>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="99"
                  min={50}
                  max={100}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="68"
                  min={1}
                  max={350}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            {/* Height & Computed BMI */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="170"
                  min={30}
                  max={260}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Computed BMI</span>
                <span className="font-mono text-sm font-black text-teal-700">
                  {computedBmi ? `${computedBmi} kg/m²` : '--'}
                </span>
              </div>
            </div>

            {/* Nursing Notes */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Triage Observation & Chief Complaints
              </label>
              <textarea
                rows={2}
                value={nursingNotes}
                onChange={(e) => setNursingNotes(e.target.value)}
                placeholder="Patient reports acute headache since morning, mild chills..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-teal-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsVitalsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold"
                isLoading={recordVitalsMutation.isPending}
              >
                Save Vitals & Send to Doctor
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
