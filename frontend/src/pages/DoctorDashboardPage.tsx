import React, { useState, useEffect, useRef } from 'react';
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
  FlaskConical,
  Send,
  Bookmark,
  BookOpen,
  Check,
  AlertCircle,
  ShoppingBag,
  Search,
  Edit,
  Upload,
  Download,
  CheckSquare,
  Square,
} from 'lucide-react';
import { doctorDashboardApi } from '../api/doctor.api';
import { labApi } from '../api/lab.api';
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

  const [activeTab, setActiveTab] = useState<'queue' | 'templates' | 'labs' | 'roster' | 'leaves'>('queue');
  const [sendToPharmacy, setSendToPharmacy] = useState(false);

  // Template States (CRUD, Search, Bulk Upload)
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [newTemplateDisease, setNewTemplateDisease] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [isBulkTemplateOpen, setIsBulkTemplateOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);

  // Lab Request Modal States (Lab selection & multi-test requisition)
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState('');
  const [selectedCatalogTests, setSelectedCatalogTests] = useState<Array<{ name: string; code?: string; price: number; tatHours?: number }>>([]);
  const [customLabTest, setCustomLabTest] = useState('');
  const [customLabPrice, setCustomLabPrice] = useState<number>(0);
  const [labPriority, setLabPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [labNotes, setLabNotes] = useState('');

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

  // Immediate popup/toast notifications when new patients arrive in queue or vitals ready (Requirement 13)
  const prevAppointmentsRef = useRef<Map<string, string>>(new Map());
  const isInitialAptMount = useRef(true);

  useEffect(() => {
    if (!appointments || !Array.isArray(appointments)) return;
    if (isInitialAptMount.current) {
      prevAppointmentsRef.current = new Map(appointments.map((a: any) => [a.id, a.status]));
      isInitialAptMount.current = false;
      return;
    }

    for (const apt of appointments) {
      if (!prevAppointmentsRef.current.has(apt.id)) {
        prevAppointmentsRef.current.set(apt.id, apt.status);
        toast.info(
          'New Patient in Queue',
          `${apt.patient?.fullName || 'Patient'} (Token #${apt.tokenNumber || '—'})`
        );
      } else {
        const prevStatus = prevAppointmentsRef.current.get(apt.id);
        if (prevStatus !== apt.status) {
          prevAppointmentsRef.current.set(apt.id, apt.status);
          if (apt.status === 'WAITING') {
            toast.success(
              'Patient Ready for Consultation',
              `${apt.patient?.fullName || 'Patient'} vitals recorded by nurse`
            );
          }
        }
      }
    }
  }, [appointments, toast]);

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

  // Comprehensive Consultation Details (History + Support Staff Recorded Vitals)
  const { data: consultDetails } = useQuery({
    queryKey: ['doctor-consult-details', activeAppointment?.id],
    queryFn: () => doctorDashboardApi.getConsultationDetails(activeAppointment!.id),
    enabled: !!activeAppointment && isConsultModalOpen,
  });

  // Reusable Disease-Based Prescription Templates
  const { data: templates } = useQuery({
    queryKey: ['doctor-templates'],
    queryFn: () => doctorDashboardApi.getTemplates(),
  });

  // Laboratory Test Requests
  const { data: labRequests, refetch: refetchLabRequests } = useQuery({
    queryKey: ['doctor-lab-requests'],
    queryFn: () => doctorDashboardApi.getLabRequests(),
    enabled: activeTab === 'labs',
  });

  // Automatically pre-populate vitals when Support Staff vitals are present
  React.useEffect(() => {
    const v = consultDetails?.vitals || consultDetails?.currentVitals;
    if (v) {
      setVitals({
        bp: v.bloodPressure || (v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic} mmHg` : (v.bpSystolic ? `${v.bpSystolic} mmHg` : '')),
        pulse: v.pulseRate ? `${v.pulseRate} bpm` : (v.pulse ? `${v.pulse} bpm` : ''),
        temperature: v.temperature ? `${v.temperature}°F` : '',
        weight: v.weightKg ? `${v.weightKg} kg` : (v.weight ? `${v.weight} kg` : ''),
        spo2: v.spo2 ? `${v.spo2}%` : '',
      });
    }
  }, [consultDetails]);

  // Accredited active laboratories query
  const { data: activeLabs } = useQuery({
    queryKey: ['active-approved-labs'],
    queryFn: () => labApi.getActiveLabs(),
  });

  // Tests catalog for selected lab
  const { data: labCatalog, isLoading: isCatalogLoading } = useQuery({
    queryKey: ['lab-catalog', selectedLabId],
    queryFn: () => labApi.getPublicTests({ labId: selectedLabId }),
    enabled: !!selectedLabId && isLabModalOpen,
  });

  // Auto-select lab when labs load
  React.useEffect(() => {
    if (activeLabs && activeLabs.length > 0 && !selectedLabId) {
      const hospLab = activeLabs.find((l: any) => l.hospital?.id === profile?.hospitalId) || activeLabs[0];
      setSelectedLabId(hospLab.id);
    }
  }, [activeLabs, profile, selectedLabId]);

  const parseCsvText = (raw: string) => {
    const lines = raw.trim().split('\n');
    if (lines.length <= 1) {
      setBulkPreview([]);
      return;
    }
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      const cells: string[] = [];
      let match;
      while ((match = regex.exec(line)) !== null && cells.length < 10) {
        let val = match[1] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        cells.push(val.trim());
        if (regex.lastIndex === line.length) break;
      }
      const diseaseName = cells[0] || '';
      const diagnosis = cells[1] || diseaseName;
      const medsRaw = cells[2] || '';
      const instructions = cells[3] || '';
      if (diseaseName) {
        const meds = medsRaw.split(';').map((m) => {
          const parts = m.split(':').map((p) => p.trim());
          return {
            name: parts[0] || m.trim(),
            dosage: parts[1] || '1 Tab',
            frequency: parts[2] || '1-0-1',
            duration: parts[3] || '5 days',
            instructions: parts[4] || 'After food',
          };
        }).filter((m) => m.name);
        rows.push({ diseaseName, diagnosis, medicines: meds, instructions });
      }
    }
    setBulkPreview(rows);
  };

  // Template Mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => doctorDashboardApi.createTemplate(data),
    onSuccess: () => {
      toast.success('Template Saved', 'Prescription template added to your library');
      setIsSaveTemplateOpen(false);
      setNewTemplateDisease('');
      queryClient.invalidateQueries({ queryKey: ['doctor-templates'] });
    },
    onError: (err: any) => {
      toast.error('Save Failed', err.message);
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => doctorDashboardApi.updateTemplate(id, data),
    onSuccess: () => {
      toast.success('Template Updated', 'Prescription template updated successfully');
      setEditingTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['doctor-templates'] });
    },
    onError: (err: any) => {
      toast.error('Update Failed', err.message);
    },
  });

  const bulkCreateTemplatesMutation = useMutation({
    mutationFn: (templates: any[]) => doctorDashboardApi.bulkCreateTemplates(templates),
    onSuccess: (data: any) => {
      toast.success('Templates Imported', data?.message || 'Prescription templates successfully imported');
      setIsBulkTemplateOpen(false);
      setBulkCsvText('');
      setBulkPreview([]);
      queryClient.invalidateQueries({ queryKey: ['doctor-templates'] });
    },
    onError: (err: any) => {
      toast.error('Bulk Import Failed', err.message);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => doctorDashboardApi.deleteTemplate(templateId),
    onSuccess: () => {
      toast.success('Template Deleted', 'Prescription template removed');
      queryClient.invalidateQueries({ queryKey: ['doctor-templates'] });
    },
    onError: (err: any) => {
      toast.error('Delete Failed', err.message);
    },
  });

  // Diagnostic Lab Request Mutation
  const createLabRequestMutation = useMutation({
    mutationFn: (data: any) => doctorDashboardApi.createLabRequest(data),
    onSuccess: () => {
      toast.success('Lab Test Requested', 'Requisition sent to approved laboratory queue');
      setIsLabModalOpen(false);
      setSelectedCatalogTests([]);
      setCustomLabTest('');
      setCustomLabPrice(0);
      setLabNotes('');
      queryClient.invalidateQueries({ queryKey: ['doctor-lab-requests'] });
    },
    onError: (err: any) => {
      toast.error('Lab Requisition Failed', err.message);
    },
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
              onClick={() => setActiveTab('templates')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'templates' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-royal-600" />
              Rx Templates ({(templates || []).length})
            </button>
            <button
              onClick={() => setActiveTab('labs')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'labs' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
              Diagnostic Lab Requests ({(labRequests || []).length})
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

      {/* TAB: REUSABLE DISEASE-BASED PRESCRIPTION TEMPLATES */}
      {activeTab === 'templates' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-royal-600" />
                Disease-Based Prescription Template Library
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Saved reusable prescription templates for rapid, consistent medication prescribing during OPD consultations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkTemplateOpen(true)}
                className="text-xs font-bold text-slate-700 border-slate-300"
              >
                <Upload className="w-4 h-4 mr-1.5 text-royal-600" /> Bulk Import (CSV)
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setNewTemplateDisease('');
                  setIsSaveTemplateOpen(true);
                }}
                className="bg-royal-600 hover:bg-royal-700 font-bold"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Create New Template
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates by disease name, diagnosis, or medicine..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const filtered = (templates || []).filter((tmpl: any) => {
                if (!templateSearch.trim()) return true;
                const q = templateSearch.toLowerCase();
                const diseaseMatch = tmpl.diseaseName?.toLowerCase().includes(q);
                const diagMatch = tmpl.diagnosis?.toLowerCase().includes(q);
                const parsed = typeof tmpl.medicines === 'string' ? JSON.parse(tmpl.medicines) : tmpl.medicines;
                const medMatch = (parsed || []).some((m: any) => m.name?.toLowerCase().includes(q));
                return diseaseMatch || diagMatch || medMatch;
              });

              if (filtered.length === 0) {
                return (
                  <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    {templateSearch ? 'No prescription templates match your search.' : 'No prescription templates created yet. Click \'Create New Template\' or save during consultation.'}
                  </div>
                );
              }

              return filtered.map((tmpl: any) => {
                const parsedMeds = typeof tmpl.medicines === 'string' ? JSON.parse(tmpl.medicines) : tmpl.medicines;
                return (
                  <div
                    key={tmpl.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-slate-900 text-sm">{tmpl.diseaseName}</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {parsedMeds?.length || 0} Medicines
                        </Badge>
                      </div>
                      {tmpl.diagnosis && (
                        <div className="text-xs text-royal-700 font-medium">
                          Dx: {tmpl.diagnosis}
                        </div>
                      )}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-36 overflow-y-auto">
                        {(parsedMeds || []).map((m: any, idx: number) => (
                          <div key={idx} className="p-1.5 bg-slate-50 rounded-lg text-[11px] text-slate-700">
                            <span className="font-bold text-slate-900">{m.name}</span>
                            <div className="text-slate-500 text-[10px]">
                              {m.dosage} • {m.frequency} • {m.duration} {m.instructions ? `(${m.instructions})` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                      {tmpl.instructions && (
                        <p className="text-[11px] text-slate-500 italic bg-amber-50/60 p-2 rounded-lg">
                          Advice: {tmpl.instructions}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-royal-600 hover:bg-royal-50 text-xs"
                        onClick={() => {
                          setEditingTemplate({
                            id: tmpl.id,
                            diseaseName: tmpl.diseaseName,
                            diagnosis: tmpl.diagnosis || '',
                            medicines: parsedMeds || [],
                            instructions: tmpl.instructions || '',
                          });
                        }}
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50 text-xs"
                        onClick={() => deleteTemplateMutation.mutate(tmpl.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </Card>
      )}

      {/* TAB: DIAGNOSTIC LAB TEST REQUESTS */}
      {activeTab === 'labs' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-purple-600" />
                Requested Laboratory Diagnostic Tests & Reports
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Track status of diagnostic requisitions sent to hospital laboratories and view completed findings
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchLabRequests()} className="text-xs">
              Refresh Tests
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Requisition #</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Tests Ordered</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Diagnostic Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(labRequests || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No diagnostic lab requisitions ordered yet.
                    </td>
                  </tr>
                ) : (
                  (labRequests || []).map((req: any) => {
                    const parsedTests = typeof req.tests === 'string' ? JSON.parse(req.tests) : req.tests;
                    return (
                      <tr key={req.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-mono font-bold text-purple-700">
                          {req.requestNumber}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{req.patient?.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            MRN: {req.patient?.patientIdNumber || 'PENDING'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="space-y-0.5">
                            {(parsedTests || []).map((t: any, idx: number) => (
                              <div key={idx} className="font-semibold text-slate-800">
                                • {t.name}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant={req.priority === 'URGENT' ? 'danger' : 'outline'}
                            className="text-[10px]"
                          >
                            {req.priority}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant={
                              req.status === 'COMPLETED'
                                ? 'success'
                                : req.status === 'PROCESSING'
                                ? 'purple'
                                : req.status === 'RECEIVED'
                                ? 'info'
                                : 'warning'
                            }
                            className="text-[10px]"
                          >
                            {req.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 max-w-xs">
                          {req.report ? (
                            <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1">
                              <span className="font-bold text-emerald-800 block text-[11px]">Findings:</span>
                              <div className="text-[11px] text-slate-700 whitespace-pre-wrap">
                                {req.report.results}
                              </div>
                              {req.report.fileUrl && (
                                <a
                                  href={req.report.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-royal-600 font-bold underline block text-[10px]"
                                >
                                  View Official Report PDF
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Awaiting lab results</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
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
          <div className="space-y-5 text-xs">
            {/* Patient Demographics & MRN Banner */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 text-sm">
                  {activeAppointment.patient.fullName}
                </span>
                <span className="text-[11px] text-slate-500 ml-2 font-mono">
                  MRN: <strong className="text-royal-700">{consultDetails?.patient?.patientIdNumber || activeAppointment.patient.id.slice(0, 8).toUpperCase()}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 font-medium">
                <span>Age: {consultDetails?.patient?.age || '--'}</span>
                <span>•</span>
                <span>Gender: {consultDetails?.patient?.gender || '--'}</span>
                <span>•</span>
                <span className="font-bold text-rose-600">Blood: {consultDetails?.patient?.bloodGroup || 'N/A'}</span>
                <span>•</span>
                <span>Mobile: +91 {activeAppointment.patient.mobileNumber}</span>
              </div>
            </div>

            {/* Support Staff Recorded Vitals Banner */}
            {(consultDetails?.vitals || consultDetails?.currentVitals) ? (
              (() => {
                const rv = consultDetails?.vitals || consultDetails?.currentVitals;
                return (
                  <div className="p-3 bg-teal-50/90 border border-teal-200 rounded-xl space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-teal-900 flex items-center gap-1.5 text-xs">
                        <Activity className="w-4 h-4 text-teal-600 animate-pulse" />
                        Clinical Vitals Recorded by Nursing / Support Staff
                      </span>
                      <span className="text-[10px] text-teal-800 font-bold bg-teal-100 border border-teal-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-teal-600" />
                        Pre-Screened
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1 font-mono text-xs text-slate-800">
                      <div>BP: <strong className="font-bold text-slate-900">{rv.bloodPressure || (rv.bpSystolic ? `${rv.bpSystolic}/${rv.bpDiastolic}` : 'N/A')}</strong></div>
                      <div>Pulse: <strong className="font-bold text-slate-900">{rv.pulseRate || rv.pulse || 'N/A'} bpm</strong></div>
                      <div>Temp: <strong className="font-bold text-slate-900">{rv.temperature || 'N/A'}°F</strong></div>
                      <div>SpO2: <strong className="font-bold text-slate-900">{rv.spo2 || 'N/A'}%</strong></div>
                      <div>Weight: <strong className="font-bold text-slate-900">{rv.weightKg || rv.weight || 'N/A'} kg</strong></div>
                      <div>Height: <strong className="font-bold text-slate-900">{rv.heightCm || rv.height || 'N/A'} cm</strong></div>
                    </div>
                    {rv.notes && (
                      <div className="text-[11px] text-teal-900 italic pt-0.5">
                        Nursing Observations: "{rv.notes}"
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>No support staff screening vitals recorded yet. You may enter vitals manually below.</span>
              </div>
            )}

            {/* Editable Vitals Bar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700 block mb-2">Consultation Vitals (Doctor Verified):</span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">Blood Pressure</span>
                  <input
                    type="text"
                    value={vitals.bp}
                    onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Pulse Rate</span>
                  <input
                    type="text"
                    value={vitals.pulse}
                    onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Temperature</span>
                  <input
                    type="text"
                    value={vitals.temperature}
                    onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Weight</span>
                  <input
                    type="text"
                    value={vitals.weight}
                    onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SpO2</span>
                  <input
                    type="text"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                    className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Disease Template Selector Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-royal-50/70 rounded-xl border border-royal-200/80">
              <div className="flex items-center gap-2 flex-1">
                <BookOpen className="w-4 h-4 text-royal-600 shrink-0" />
                <span className="font-bold text-royal-900 text-xs shrink-0">Apply Rx Template:</span>
                <select
                  onChange={(e) => {
                    const t = templates?.find((tmpl: any) => tmpl.id === e.target.value);
                    if (t) {
                      if (t.diagnosis) setDiagnosis(t.diagnosis);
                      const parsedMeds = typeof t.medicines === 'string' ? JSON.parse(t.medicines) : t.medicines;
                      if (Array.isArray(parsedMeds) && parsedMeds.length > 0) {
                        setMedicines(parsedMeds);
                      }
                      if (t.instructions) setClinicalNotes(t.instructions);
                      toast.success('Template Loaded', `Applied preset prescription for ${t.diseaseName}`);
                    }
                  }}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-royal-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-royal-500"
                >
                  <option value="">Choose disease template (e.g. Viral Fever, Gastroenteritis)...</option>
                  {(templates || []).map((tmpl: any) => {
                    const medsCount = typeof tmpl.medicines === 'string' ? JSON.parse(tmpl.medicines).length : tmpl.medicines.length;
                    return (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.diseaseName} ({medsCount} meds)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewTemplateDisease(diagnosis || '');
                    setIsSaveTemplateOpen(true);
                  }}
                  className="text-xs border-royal-300 text-royal-700 hover:bg-royal-100"
                >
                  <Bookmark className="w-3.5 h-3.5 mr-1" /> Save as Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLabModalOpen(true)}
                  className="text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <FlaskConical className="w-3.5 h-3.5 mr-1" /> Request Lab Test
                </Button>
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
                placeholder="e.g. Acute Bronchitis / Essential Hypertension / Viral Pharyngitis"
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
                      className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Frequency</span>
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => updateMedicine(idx, 'frequency', e.target.value)}
                      placeholder="e.g. BD (Twice daily)"
                      className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Duration</span>
                    <input
                      type="text"
                      value={med.duration}
                      onChange={(e) => updateMedicine(idx, 'duration', e.target.value)}
                      placeholder="e.g. 5 days"
                      className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={med.instructions}
                      onChange={(e) => updateMedicine(idx, 'instructions', e.target.value)}
                      placeholder="After food"
                      className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white"
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
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white"
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
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white"
                />
              </div>
            </div>

            {/* Pharmacy Dispatch Option */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between">
              <label htmlFor="sendToPharmacy" className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs">
                <input
                  type="checkbox"
                  id="sendToPharmacy"
                  checked={sendToPharmacy}
                  onChange={(e) => setSendToPharmacy(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="flex items-center gap-1.5 text-emerald-900">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  Route Prescription directly to In-house Pharmacy for Medication Dispensing
                </span>
              </label>
              {sendToPharmacy && (
                <Badge variant="success" className="text-[10px]">
                  Pharmacy Queue
                </Badge>
              )}
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
                      diagnosis: diagnosis.trim(),
                      symptoms: symptoms.trim() || undefined,
                      clinicalNotes: clinicalNotes.trim() || undefined,
                      followUpDate: followUpDate.trim() || undefined,
                      vitals,
                      medicines,
                      sendToPharmacy,
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

      {/* SAVE AS PRESCRIPTION TEMPLATE MODAL */}
      {isSaveTemplateOpen && (
        <Modal
          isOpen={isSaveTemplateOpen}
          onClose={() => setIsSaveTemplateOpen(false)}
          title="Save Prescription Template"
          maxWidth="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTemplateDisease.trim()) {
                toast.error('Disease Name Required', 'Please enter the disease or condition name for this template.');
                return;
              }
              createTemplateMutation.mutate({
                diseaseName: newTemplateDisease.trim(),
                diagnosis: diagnosis.trim() || newTemplateDisease.trim(),
                medicines: medicines.filter((m) => m.name.trim()),
                instructions: clinicalNotes.trim() || undefined,
              });
            }}
            className="space-y-4 text-xs"
          >
            <p className="text-slate-500">
              Save current medications as a reusable disease template in your personal template library.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Disease / Condition Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newTemplateDisease}
                onChange={(e) => setNewTemplateDisease(e.target.value)}
                placeholder="e.g. Acute Gastroenteritis, Viral Fever, Type 2 DM"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-royal-500"
                required
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="font-bold text-slate-700 block text-[11px]">Medicines in this template:</span>
              {medicines.filter((m) => m.name.trim()).map((m, i) => (
                <div key={i} className="text-slate-600 text-[11px]">
                  • {m.name} ({m.dosage}, {m.frequency}, {m.duration})
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsSaveTemplateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-royal-600 hover:bg-royal-700 font-bold"
                isLoading={createTemplateMutation.isPending}
              >
                Save Template
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* REQUEST DIAGNOSTIC LAB TEST MODAL */}
      {isLabModalOpen && activeAppointment && (
        <Modal
          isOpen={isLabModalOpen}
          onClose={() => setIsLabModalOpen(false)}
          title={`Order Diagnostic Lab Tests - ${activeAppointment.patient.fullName}`}
          maxWidth="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const finalTests: any[] = [...selectedCatalogTests];
              if (customLabTest.trim()) {
                finalTests.push({
                  name: customLabTest.trim(),
                  price: Number(customLabPrice || 0),
                  notes: 'Custom Doctor Requisition',
                });
              }

              if (finalTests.length === 0) {
                toast.error('Test Selection Required', 'Please choose at least one test from the catalog or specify a custom test.');
                return;
              }

              createLabRequestMutation.mutate({
                appointmentId: activeAppointment.id,
                patientId: activeAppointment.patient.id,
                labId: selectedLabId || undefined,
                tests: finalTests,
                priority: labPriority,
                clinicalNotes: labNotes.trim() || undefined,
              });
            }}
            className="space-y-4 text-xs"
          >
            {/* Laboratory Selector */}
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1.5">
              <label className="block font-bold text-purple-900 text-xs flex items-center justify-between">
                <span>Select Approved Diagnostic Laboratory:</span>
                <span className="text-[10px] text-purple-700 font-semibold bg-purple-100 px-2 py-0.5 rounded-full">
                  {(activeLabs || []).length} Accredited Labs Available
                </span>
              </label>
              <select
                value={selectedLabId}
                onChange={(e) => {
                  setSelectedLabId(e.target.value);
                  setSelectedCatalogTests([]);
                }}
                className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              >
                {(activeLabs || []).map((lab: any) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.name} ({lab.type === 'HOSPITAL_LAB' ? `In-Hospital: ${lab.hospital?.name || ''}` : 'Independent Center'}) - {lab.testsCount || 0} tests available
                  </option>
                ))}
              </select>
            </div>

            {/* Test Catalog Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-xs">
                  Select Tests from Laboratory Catalog (Multiple Allowed):
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (labCatalog && labCatalog.length > 0) {
                        setSelectedCatalogTests(
                          labCatalog.map((t: any) => ({
                            name: t.name,
                            code: t.code,
                            price: t.price,
                            tatHours: t.tatHours,
                          }))
                        );
                      }
                    }}
                    className="text-purple-600 hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCatalogTests([])}
                    className="text-slate-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {isCatalogLoading ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl">
                  Loading test catalog...
                </div>
              ) : (labCatalog || []).length === 0 ? (
                <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No tests listed in catalog for this lab. You can add a custom test below.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-xl">
                  {(labCatalog || []).map((test: any) => {
                    const isSelected = selectedCatalogTests.some((t) => t.code === test.code || t.name === test.name);
                    return (
                      <div
                        key={test.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCatalogTests(selectedCatalogTests.filter((t) => t.code !== test.code && t.name !== test.name));
                          } else {
                            setSelectedCatalogTests([
                              ...selectedCatalogTests,
                              { name: test.name, code: test.code, price: test.price, tatHours: test.tatHours },
                            ]);
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-purple-50/80 border-purple-300 ring-1 ring-purple-400'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 shrink-0" />
                            )}
                            <span className="font-bold text-slate-900 text-xs truncate">{test.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 pl-5">
                            {test.category} • Turnaround: {test.tatHours ? `${test.tatHours}h` : 'Same Day'}
                          </div>
                        </div>
                        <span className="font-bold text-purple-700 text-xs shrink-0">
                          ₹{test.price}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom Additional Test Input */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-700 text-[11px]">
                Add Custom Diagnostic Test (Optional):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={customLabTest}
                  onChange={(e) => setCustomLabTest(e.target.value)}
                  placeholder="e.g. 2D Echocardiogram, USG Abdomen"
                  className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                />
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-xs">₹</span>
                  <input
                    type="number"
                    value={customLabPrice || ''}
                    onChange={(e) => setCustomLabPrice(Number(e.target.value) || 0)}
                    placeholder="Est. Fee (₹)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Requisition Summary Bar */}
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-purple-950 block text-xs">
                  Requisition Summary: {selectedCatalogTests.length + (customLabTest.trim() ? 1 : 0)} Test(s) Selected
                </span>
                <span className="text-[10px] text-purple-700">
                  {selectedCatalogTests.map((t) => t.name).concat(customLabTest.trim() ? [customLabTest.trim()] : []).join(', ') || 'No tests selected'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Total Est. Cost</span>
                <span className="text-base font-black text-purple-900">
                  ₹{selectedCatalogTests.reduce((acc, t) => acc + (t.price || 0), 0) + (customLabTest.trim() ? Number(customLabPrice || 0) : 0)}
                </span>
              </div>
            </div>

            {/* Priority & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requisition Priority</label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="NORMAL"
                      checked={labPriority === 'NORMAL'}
                      onChange={() => setLabPriority('NORMAL')}
                    />
                    <span>Normal Routine</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-rose-600">
                    <input
                      type="radio"
                      name="priority"
                      value="URGENT"
                      checked={labPriority === 'URGENT'}
                      onChange={() => setLabPriority('URGENT')}
                    />
                    <span>Urgent / Stat</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Clinical Indication / Instructions
                </label>
                <input
                  type="text"
                  value={labNotes}
                  onChange={(e) => setLabNotes(e.target.value)}
                  placeholder="Suspected infection, pre-op evaluation..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsLabModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                isLoading={createLabRequestMutation.isPending}
              >
                Send Requisition to Lab
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT PRESCRIPTION TEMPLATE MODAL */}
      {editingTemplate && (
        <Modal
          isOpen={!!editingTemplate}
          onClose={() => setEditingTemplate(null)}
          title={`Edit Prescription Template - ${editingTemplate.diseaseName}`}
          maxWidth="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingTemplate.diseaseName?.trim()) {
                toast.error('Disease Name Required', 'Please enter a disease/condition name.');
                return;
              }
              updateTemplateMutation.mutate({
                id: editingTemplate.id,
                data: {
                  diseaseName: editingTemplate.diseaseName.trim(),
                  diagnosis: editingTemplate.diagnosis?.trim() || editingTemplate.diseaseName.trim(),
                  medicines: editingTemplate.medicines || [],
                  instructions: editingTemplate.instructions?.trim() || undefined,
                },
              });
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Disease / Condition Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingTemplate.diseaseName}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, diseaseName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={editingTemplate.diagnosis || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Medicines List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">Prescription Medications:</label>
                <button
                  type="button"
                  onClick={() => {
                    const current = editingTemplate.medicines || [];
                    setEditingTemplate({
                      ...editingTemplate,
                      medicines: [
                        ...current,
                        { name: '', dosage: '1 Tab', frequency: '1-0-1', duration: '5 days', instructions: 'After food' },
                      ],
                    });
                  }}
                  className="text-royal-600 text-xs font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Medicine
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-xl">
                {(editingTemplate.medicines || []).map((m: any, idx: number) => (
                  <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Medication Name"
                      value={m.name}
                      onChange={(e) => {
                        const copy = [...editingTemplate.medicines];
                        copy[idx].name = e.target.value;
                        setEditingTemplate({ ...editingTemplate, medicines: copy });
                      }}
                      className="sm:col-span-2 px-2 py-1 rounded border border-slate-200 text-xs bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Dosage"
                      value={m.dosage}
                      onChange={(e) => {
                        const copy = [...editingTemplate.medicines];
                        copy[idx].dosage = e.target.value;
                        setEditingTemplate({ ...editingTemplate, medicines: copy });
                      }}
                      className="px-2 py-1 rounded border border-slate-200 text-xs bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Frequency"
                      value={m.frequency}
                      onChange={(e) => {
                        const copy = [...editingTemplate.medicines];
                        copy[idx].frequency = e.target.value;
                        setEditingTemplate({ ...editingTemplate, medicines: copy });
                      }}
                      className="px-2 py-1 rounded border border-slate-200 text-xs bg-white"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Duration"
                        value={m.duration}
                        onChange={(e) => {
                          const copy = [...editingTemplate.medicines];
                          copy[idx].duration = e.target.value;
                          setEditingTemplate({ ...editingTemplate, medicines: copy });
                        }}
                        className="w-full px-2 py-1 rounded border border-slate-200 text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const copy = editingTemplate.medicines.filter((_: any, i: number) => i !== idx);
                          setEditingTemplate({ ...editingTemplate, medicines: copy });
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinical Instructions & Advice</label>
              <textarea
                rows={2}
                value={editingTemplate.instructions || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, instructions: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-royal-600 hover:bg-royal-700 font-bold"
                isLoading={updateTemplateMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* BULK UPLOAD PRESCRIPTION TEMPLATES MODAL */}
      {isBulkTemplateOpen && (
        <Modal
          isOpen={isBulkTemplateOpen}
          onClose={() => setIsBulkTemplateOpen(false)}
          title="Bulk Upload Prescription Templates (CSV / Excel)"
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-royal-50/70 border border-royal-200 rounded-xl">
              <div>
                <span className="font-bold text-royal-950 block">Standard Format: CSV or Tab-separated</span>
                <span className="text-[11px] text-royal-700">
                  Headers: diseaseName, diagnosis, medicines (Name:Dose:Freq:Days), instructions
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const sampleCsv =
                    'diseaseName,diagnosis,medicines,instructions\n' +
                    '"Viral Fever","Acute Febrile Illness","Paracetamol 650mg:1 Tab:1-0-1:5 days;Cetirizine 10mg:1 Tab:0-0-1:3 days","Warm fluids and rest"\n' +
                    '"Acute Gastroenteritis","Acute Diarrhea","Ofloxacin-Ornidazole:1 Tab:1-0-1:5 days;ORS Sachet:1 Sachet:As needed:3 days","Hydration with ORS"\n' +
                    '"Hypertension","Primary Hypertension","Telmisartan 40mg:1 Tab:1-0-0:30 days;Amlodipine 5mg:1 Tab:0-0-1:30 days","Low salt diet, weekly BP log"';
                  const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'sample_prescription_templates.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs font-bold text-royal-700 border-royal-300 hover:bg-royal-100"
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Download Sample CSV
              </Button>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Upload CSV File or Paste Data:
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const text = evt.target?.result as string;
                      setBulkCsvText(text || '');
                      parseCsvText(text || '');
                    };
                    reader.readAsText(file);
                  }
                }}
                className="mb-2 block w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-royal-50 file:text-royal-700 hover:file:bg-royal-100"
              />
              <textarea
                rows={5}
                value={bulkCsvText}
                onChange={(e) => {
                  setBulkCsvText(e.target.value);
                  parseCsvText(e.target.value);
                }}
                placeholder="Paste CSV content here (including header row)..."
                className="w-full font-mono text-[11px] p-2.5 rounded-xl border border-slate-200"
              />
            </div>

            {bulkPreview.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-slate-700 block">
                  Preview: {bulkPreview.length} Template(s) Ready to Import
                </span>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Disease</th>
                        <th className="px-3 py-2">Diagnosis</th>
                        <th className="px-3 py-2">Medicines Count</th>
                        <th className="px-3 py-2">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {bulkPreview.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5 font-bold text-slate-900">{item.diseaseName}</td>
                          <td className="px-3 py-1.5">{item.diagnosis}</td>
                          <td className="px-3 py-1.5 font-mono text-royal-600">{item.medicines?.length || 0} meds</td>
                          <td className="px-3 py-1.5 truncate max-w-xs">{item.instructions || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsBulkTemplateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={bulkPreview.length === 0}
                className="bg-royal-600 hover:bg-royal-700 font-bold"
                onClick={() => bulkCreateTemplatesMutation.mutate(bulkPreview)}
                isLoading={bulkCreateTemplatesMutation.isPending}
              >
                Import {bulkPreview.length} Template(s)
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
