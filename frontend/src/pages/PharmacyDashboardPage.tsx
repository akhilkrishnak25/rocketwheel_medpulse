import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pill,
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  User,
  Check,
  Calendar,
  AlertCircle,
  AlertTriangle,
  LogOut,
  FileText,
  PackageCheck,
  Printer,
  Download,
  RefreshCw,
} from 'lucide-react';
import { pharmacyApi } from '../api/pharmacy.api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { Prescription } from '../types';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';
import { sortMedicinesByPriority } from '../utils/medicines';

export const PharmacyDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, logout } = useAuth();

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Unavailable medicine substitution modal state
  const [substitutingRx, setSubstitutingRx] = useState<any | null>(null);
  const [substitutingMedicineIndex, setSubstitutingMedicineIndex] = useState<number | null>(null);
  const [substitutingMedicine, setSubstitutingMedicine] = useState<any | null>(null);

  // Replacement form fields
  const [replacementName, setReplacementName] = useState('');
  const [replacementDosage, setReplacementDosage] = useState('');
  const [replacementFrequency, setReplacementFrequency] = useState('');
  const [replacementDuration, setReplacementDuration] = useState('');
  const [replacementInstructions, setReplacementInstructions] = useState('');
  const [substitutionReason, setSubstitutionReason] = useState('');
  const [doctorApproved, setDoctorApproved] = useState(true);

  // PDF generation loading state
  const [printingRxId, setPrintingRxId] = useState<string | null>(null);

  // Fetch prescriptions routed to pharmacy
  const { data: prescriptions, isLoading, refetch } = useQuery({
    queryKey: ['pharmacy-prescriptions', statusFilter],
    queryFn: () => pharmacyApi.getPrescriptions(statusFilter === 'ALL' ? undefined : statusFilter),
    refetchInterval: 8000,
  });

  // Update dispensing status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACCEPTED' | 'PROCESSING' | 'COMPLETED' }) =>
      pharmacyApi.updateStatus(id, status),
    onSuccess: (_, vars) => {
      toast.success('Prescription Status Updated', `Order set to ${vars.status}`);
      queryClient.invalidateQueries({ queryKey: ['pharmacy-prescriptions'] });
    },
    onError: (err: any) => {
      toast.error('Failed to Update Status', err.message);
    },
  });

  // Replace unavailable medicine mutation
  const replaceMedicineMutation = useMutation({
    mutationFn: (data: {
      prescriptionId: string;
      medicineIndex: number;
      originalName?: string;
      replacement: {
        name: string;
        dosage?: string;
        frequency?: string;
        duration?: string;
        instructions?: string;
      };
      reason: string;
      doctorApproved?: boolean;
    }) =>
      pharmacyApi.replaceMedicine(data.prescriptionId, {
        medicineIndex: data.medicineIndex,
        originalName: data.originalName,
        replacement: data.replacement,
        reason: data.reason,
        doctorApproved: data.doctorApproved,
      }),
    onSuccess: () => {
      toast.success('Medicine Substituted', 'Prescription updated with authorized replacement medicine.');
      setSubstitutingRx(null);
      setSubstitutingMedicineIndex(null);
      setSubstitutingMedicine(null);
      queryClient.invalidateQueries({ queryKey: ['pharmacy-prescriptions'] });
    },
    onError: (err: any) => {
      toast.error('Substitution Failed', err.message);
    },
  });

  // Print Revised Prescription / Consultation Form PDF
  const handlePrintPrescriptionPdf = async (prescriptionId: string) => {
    setPrintingRxId(prescriptionId);
    toast.info('Preparing Print Document', 'Generating revised prescription document...');
    try {
      const blob = await pharmacyApi.downloadPrescriptionPdf(prescriptionId);
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        // Fallback to download if browser blocked popup
        const a = document.createElement('a');
        a.href = url;
        a.download = `Prescription-${prescriptionId.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      toast.success('Print Document Ready', 'Prescription opened. Ready to print on hospital letterhead.');
    } catch (err: any) {
      toast.error('Print Failed', err.message || 'Could not load prescription document');
    } finally {
      setPrintingRxId(null);
    }
  };

  // Download Revised Prescription PDF
  const handleDownloadPrescriptionPdf = async (prescriptionId: string, patientName?: string) => {
    setPrintingRxId(prescriptionId);
    try {
      const blob = await pharmacyApi.downloadPrescriptionPdf(prescriptionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Prescription-${(patientName || 'Patient').replace(/\s+/g, '_')}-${prescriptionId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Downloaded', 'Revised prescription PDF downloaded successfully.');
    } catch (err: any) {
      toast.error('Download Failed', err.message || 'Could not download prescription PDF');
    } finally {
      setPrintingRxId(null);
    }
  };

  const filteredPrescriptions = (prescriptions || []).filter((rx: any) => {
    if (statusFilter !== 'ALL' && rx.pharmacyStatus !== statusFilter) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    const patient = rx.patient || rx.appointment?.patient;
    const doctor = rx.doctor || rx.appointment?.doctor;
    return (
      patient?.fullName?.toLowerCase().includes(q) ||
      patient?.patientIdNumber?.toLowerCase().includes(q) ||
      patient?.mobileNumber?.toLowerCase().includes(q) ||
      doctor?.name?.toLowerCase().includes(q) ||
      doctor?.specialization?.toLowerCase().includes(q) ||
      rx.diagnosis?.toLowerCase().includes(q) ||
      rx.id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <RocketWheelLogo size="sm" />
          <div className="border-l border-slate-700 pl-3">
            <span className="text-xs font-bold text-emerald-400 block tracking-wider uppercase">
              Pharmacy & Medication Dispensing Portal
            </span>
            <span className="text-sm font-extrabold text-white">
              {user?.pharmacy?.name || user?.hospital?.name || 'In-House Hospital Pharmacy'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:block text-right">
            <div className="font-bold text-slate-200">{user?.name}</div>
            <div className="text-[11px] text-emerald-400 font-mono">
              License: {user?.pharmacy?.licenseNumber || 'DISPENSING ACTIVE'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold"
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
              <ShoppingBag className="w-6 h-6 text-emerald-600" />
              Prescription Dispensing Queue
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live orders routed directly from doctor OPD consultations for medication dispensing and inventory fulfillment
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, MRN, doctor, diagnosis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs shrink-0 font-bold text-slate-700 bg-white border-slate-300 hover:bg-slate-50 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1 text-slate-500" /> Refresh
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar whitespace-nowrap max-w-fit">
          {['ALL', 'SENT', 'ACCEPTED', 'PROCESSING', 'COMPLETED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                statusFilter === status ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status === 'SENT' ? 'NEW (SENT)' : status}
            </button>
          ))}
        </div>

        {/* Prescriptions List Cards */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Loading prescription dispensing queue...
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <div className="font-bold text-slate-700 text-sm">No prescriptions in this queue</div>
            <p className="text-slate-400">All prescription medication orders are up to date.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPrescriptions.map((rx: any) => {
              const rawMeds = typeof rx.medicines === 'string' ? JSON.parse(rx.medicines) : rx.medicines || [];
              const meds = sortMedicinesByPriority(rawMeds);
              const patient = rx.patient || rx.appointment?.patient;
              const doctor = rx.doctor || rx.appointment?.doctor;
              const status = rx.pharmacyStatus || 'SENT';
              const rxCode = `RX-${rx.id.substring(0, 8).toUpperCase()}`;

              const patientAge =
                patient?.age !== null && patient?.age !== undefined
                  ? `${patient.age} Yrs`
                  : patient?.dateOfBirth
                  ? `${Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} Yrs`
                  : 'Age N/A';

              const hasSubstitutions = (meds || []).some((m: any) => m.isSubstituted);

              return (
                <div
                  key={rx.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-slate-900 text-base">{patient?.fullName || 'Walk-in Patient'}</h3>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-bold border border-slate-200">
                            {rxCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          MRN: <strong className="text-royal-700">{patient?.patientIdNumber || 'PENDING'}</strong> • Age: <strong className="text-slate-800">{patientAge}</strong> • Gender: <strong className="text-slate-800">{patient?.gender || 'N/A'}</strong> • +91 {patient?.mobileNumber}
                        </div>
                      </div>

                      <Badge
                        variant={
                          status === 'COMPLETED'
                            ? 'success'
                            : status === 'PROCESSING'
                            ? 'purple'
                            : status === 'ACCEPTED'
                            ? 'info'
                            : 'warning'
                        }
                        className="text-[10px]"
                      >
                        {status === 'SENT' ? 'NEW ORDER' : status}
                      </Badge>
                    </div>

                    {/* Prescriber & Diagnosis */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Prescribing Physician</span>
                        <span className="font-bold text-slate-800 text-xs block">Dr. {doctor?.name || 'Assigned Doctor'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {doctor?.specialization || 'Clinical OPD'} {doctor?.id ? `• Doc ID: ${doctor.id.substring(0, 8).toUpperCase()}` : ''}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Provisional Diagnosis</span>
                        <span className="font-bold text-royal-700 text-xs">{rx.diagnosis}</span>
                      </div>
                    </div>

                    {/* Clinical Vitals Section */}
                    {rx.vitals && (rx.vitals.bp || rx.vitals.pulse || rx.vitals.temperature || rx.vitals.spo2 || rx.vitals.weight || rx.vitals.height) && (
                      <div className="p-2.5 bg-blue-50/60 border border-blue-200/70 rounded-xl text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-royal-900 font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-royal-600 inline-block"></span>
                          Clinical Vitals (Doctor Verified):
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-slate-800">
                          {rx.vitals.bp && <span>BP: <strong className="text-slate-900">{rx.vitals.bp}</strong></span>}
                          {rx.vitals.pulse && <span>Pulse: <strong className="text-slate-900">{rx.vitals.pulse}</strong></span>}
                          {rx.vitals.temperature && <span>Temp: <strong className="text-slate-900">{rx.vitals.temperature}</strong></span>}
                          {rx.vitals.spo2 && <span>SpO₂: <strong className="text-slate-900">{rx.vitals.spo2}</strong></span>}
                          {rx.vitals.weight && <span>Weight: <strong className="text-slate-900">{rx.vitals.weight}</strong></span>}
                          {rx.vitals.height && <span>Height: <strong className="text-slate-900">{rx.vitals.height}</strong></span>}
                          {rx.vitals.bmi && <span>BMI: <strong className="text-slate-900">{rx.vitals.bmi}</strong></span>}
                        </div>
                      </div>
                    )}

                    {/* Prescribed Medications & Substitution Section */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 block uppercase tracking-wide">
                          Prescribed Medications (Sorted by Priority):
                        </span>
                        {hasSubstitutions && (
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            REVISED PRESCRIPTION
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {(meds || []).map((m: any, i: number) => {
                          const isSub = Boolean(m.isSubstituted);
                          return (
                            <div
                              key={i}
                              className={`p-2.5 rounded-xl border text-xs transition-all ${
                                isSub
                                  ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                                  : 'bg-emerald-50/50 border-emerald-200/60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 text-xs">{m.name}</span>
                                    {typeof m.priority === 'number' && m.priority > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-royal-100 text-royal-800 font-bold text-[9px] border border-royal-200">
                                        Priority #{m.priority}
                                      </span>
                                    )}
                                    {isSub && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 font-bold text-[9px] uppercase tracking-wider border border-amber-400">
                                        Substituted
                                      </span>
                                    )}
                                    {m.doctorApproved && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[9px]">
                                        ✓ Clinically Confirmed
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-600">
                                    Dosage: <strong>{m.dosage}</strong> • Freq: <strong>{m.frequency}</strong> • Duration: <strong>{m.duration}</strong>
                                    {m.strength && ` • Strength: ${m.strength}`}
                                    {m.formulation && ` • ${m.formulation}`}
                                  </div>
                                  {m.instructions && (
                                    <div className="text-[10px] text-slate-500 italic">
                                      Instructions: {m.instructions}
                                    </div>
                                  )}

                                  {/* Substitution Audit Information */}
                                  {isSub && (
                                    <div className="mt-1.5 p-2 rounded-lg bg-white/90 border border-amber-200 text-[10px] space-y-0.5 text-amber-900">
                                      <div>
                                        <strong>Original Prescribed:</strong> <span className="line-through text-slate-500">{m.originalMedicine}</span>
                                        {m.originalDosage && ` (${m.originalDosage})`}
                                      </div>
                                      <div>
                                        <strong>Reason for Substitution:</strong> {m.substitutionReason}
                                      </div>
                                      {m.substitutedBy && (
                                        <div className="text-slate-500 font-mono text-[9.5px]">
                                          Replaced by {m.substitutedBy}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Replace / Substitute Action button */}
                                {status !== 'COMPLETED' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 shadow-2xs py-1 px-2 h-auto"
                                    onClick={() => {
                                      const rawIndex = rawMeds.findIndex(
                                        (rm: any) =>
                                          rm.name === m.name &&
                                          rm.dosage === m.dosage &&
                                          rm.priority === m.priority
                                      );
                                      const targetIdx = rawIndex !== -1 ? rawIndex : i;
                                      setSubstitutingRx(rx);
                                      setSubstitutingMedicineIndex(targetIdx);
                                      setSubstitutingMedicine(m);
                                      setReplacementName(m.isSubstituted ? m.name : '');
                                      setReplacementDosage(m.dosage || '1 tablet');
                                      setReplacementFrequency(m.frequency || '1-0-1');
                                      setReplacementDuration(m.duration || '5 days');
                                      setReplacementInstructions(m.instructions || 'After food');
                                      setSubstitutionReason(m.substitutionReason || '');
                                      setDoctorApproved(true);
                                    }}
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1 text-amber-600" />
                                    {isSub ? 'Edit Substitution' : 'Out of Stock / Replace'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {rx.instructions && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                        Doctor Advice: "{rx.instructions}"
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-[10px] font-mono text-slate-400">
                      Prescribed: {new Date(rx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* Print Revised Prescription button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-2xs"
                        onClick={() => handlePrintPrescriptionPdf(rx.id)}
                        disabled={printingRxId === rx.id}
                        title="Print Revised Prescription / Consultation Form reflecting final authorized medicines"
                      >
                        <Printer className="w-3.5 h-3.5 mr-1 text-slate-600" />
                        Print Revised Prescription
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-2xs"
                        onClick={() => handleDownloadPrescriptionPdf(rx.id, patient?.fullName)}
                        disabled={printingRxId === rx.id}
                        title="Download Revised Prescription PDF"
                      >
                        <Download className="w-3.5 h-3.5 mr-1 text-slate-600" />
                        PDF
                      </Button>

                      {status === 'SENT' && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                          onClick={() => updateStatusMutation.mutate({ id: rx.id, status: 'ACCEPTED' })}
                          isLoading={updateStatusMutation.isPending}
                        >
                          Accept Order
                        </Button>
                      )}

                      {status === 'ACCEPTED' && (
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                          onClick={() => updateStatusMutation.mutate({ id: rx.id, status: 'PROCESSING' })}
                          isLoading={updateStatusMutation.isPending}
                        >
                          Prepare Medicines
                        </Button>
                      )}

                      {status === 'PROCESSING' && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                          onClick={() => updateStatusMutation.mutate({ id: rx.id, status: 'COMPLETED' })}
                          isLoading={updateStatusMutation.isPending}
                        >
                          <PackageCheck className="w-3.5 h-3.5 mr-1" /> Dispense to Patient
                        </Button>
                      )}

                      {status === 'COMPLETED' && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Dispensed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* REPLACE UNAVAILABLE MEDICINE MODAL */}
      {substitutingRx && substitutingMedicine && substitutingMedicineIndex !== null && (
        <Modal
          isOpen={!!substitutingRx}
          onClose={() => !replaceMedicineMutation.isPending && setSubstitutingRx(null)}
          title={`Replace Unavailable Medicine - Prescription #${substitutingRx.id.slice(0, 8).toUpperCase()}`}
          maxWidth="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!replacementName.trim()) {
                toast.error('Validation Error', 'Please enter the replacement medicine name.');
                return;
              }
              if (!substitutionReason.trim()) {
                toast.error('Validation Error', 'Please enter the clinical reason for medicine substitution.');
                return;
              }
              replaceMedicineMutation.mutate({
                prescriptionId: substitutingRx.id,
                medicineIndex: substitutingMedicineIndex,
                originalName: substitutingMedicine.name,
                replacement: {
                  name: replacementName.trim(),
                  dosage: replacementDosage.trim() || substitutingMedicine.dosage,
                  frequency: replacementFrequency.trim() || substitutingMedicine.frequency,
                  duration: replacementDuration.trim() || substitutingMedicine.duration,
                  instructions: replacementInstructions.trim() || substitutingMedicine.instructions,
                },
                reason: substitutionReason.trim(),
                doctorApproved,
              });
            }}
            className="space-y-4 text-xs"
          >
            {/* Prescribed Medicine (Out of stock) */}
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-rose-900">
              <div className="flex items-center gap-2 font-black text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                Original Prescribed Medicine (Unavailable / Out of Stock)
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200 text-slate-800">
                <div className="font-extrabold text-sm text-slate-900">{substitutingMedicine.name}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Dosage: <strong>{substitutingMedicine.dosage}</strong> • Frequency: <strong>{substitutingMedicine.frequency}</strong> • Duration: <strong>{substitutingMedicine.duration}</strong>
                </div>
                {substitutingMedicine.instructions && (
                  <div className="text-[10px] text-slate-500 italic mt-0.5">
                    Instructions: "{substitutingMedicine.instructions}"
                  </div>
                )}
                <div className="text-[10px] text-slate-500 font-mono mt-1 border-t border-slate-100 pt-1">
                  Physician: Dr. {substitutingRx.doctor?.name || 'Doctor'} • Diagnosis: {substitutingRx.diagnosis}
                </div>
              </div>
            </div>

            {/* Substitution Guidelines notice */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
              <strong>Clinical Pharmacy Substitution Rule:</strong> Only therapeutic or generic equivalents matching the patient's indication should be dispensed. The original consultation diagnosis and physician notes remain intact.
            </div>

            {/* Replacement Form Inputs */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider block">
                Authorized Replacement Details (From Pharmacy Inventory):
              </span>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Replacement Medicine Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amoxyclav 625mg Tablet / Paracetamol 650mg"
                  value={replacementName}
                  onChange={(e) => setReplacementName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Dosage / Strength</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 Tablet / 500mg"
                    value={replacementDosage}
                    onChange={(e) => setReplacementDosage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Frequency</label>
                  <input
                    type="text"
                    placeholder="e.g. 1-0-1 / TDS"
                    value={replacementFrequency}
                    onChange={(e) => setReplacementFrequency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Duration</label>
                  <input
                    type="text"
                    placeholder="e.g. 5 days / 7 days"
                    value={replacementDuration}
                    onChange={(e) => setReplacementDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Patient Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. After meals with warm water"
                  value={replacementInstructions}
                  onChange={(e) => setReplacementInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Reason for Substitution <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Prescribed brand out of stock; substituted equivalent generic formulation with same therapeutic active."
                  value={substitutionReason}
                  onChange={(e) => setSubstitutionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="doctorApprovedCheck"
                  checked={doctorApproved}
                  onChange={(e) => setDoctorApproved(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="doctorApprovedCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Clinically equivalent substitution confirmed with prescribing physician / hospital formulary protocol
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 font-bold text-xs"
                onClick={() => setSubstitutingRx(null)}
                disabled={replaceMedicineMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                disabled={replaceMedicineMutation.isPending}
              >
                {replaceMedicineMutation.isPending ? 'Updating Prescription...' : 'Confirm & Apply Replacement'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
