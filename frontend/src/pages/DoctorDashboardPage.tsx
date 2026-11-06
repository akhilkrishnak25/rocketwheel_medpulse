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
  Save,
  AlertTriangle,
  Upload,
  Download,
  CheckSquare,
  Square,
  Camera,
  UserCheck,
  Printer,
  Calendar,
  CalendarDays,
  RotateCcw,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { doctorDashboardApi } from '../api/doctor.api';
import { labApi } from '../api/lab.api';
import { uploadApi, getMediaUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { InlineSpinner } from '../components/ui/Loading';
import { Appointment, MedicineCatalogItem } from '../types';
import { DoctorEditProfileSection } from '../components/DoctorEditProfileSection';
import { DoctorLetterheadBrandingSection } from '../components/DoctorLetterheadBrandingSection';
import {
  formatBP,
  formatSystolicDiastolicBP,
  formatPulse,
  formatTemperature,
  formatSpO2,
  formatWeight,
  formatHeight,
  calculateBMI,
} from '../utils/vitals';
import { sortMedicinesByPriority } from '../utils/medicines';

interface MedicineItem {
  _id?: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  priority?: number;
  isSubstituted?: boolean;
  originalMedicine?: string;
  substitutionReason?: string;
}

export const DoctorDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, updateUser } = useAuth();

  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [isUnsavedWarningOpen, setIsUnsavedWarningOpen] = useState(false);
  const [pendingSwitchAppointment, setPendingSwitchAppointment] = useState<Appointment | null>(null);
  const lastSavedSnapshotRef = useRef<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringDraftRef = useRef(false);

  const [activeTab, setActiveTab] = useState<'queue' | 'templates' | 'labs' | 'roster' | 'leaves' | 'profile' | 'branding'>('queue');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['queue', 'templates', 'labs', 'roster', 'leaves', 'profile', 'branding'].includes(hash)) {
        setActiveTab(hash as any);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [sendToPharmacy, setSendToPharmacy] = useState(false);

  // Profile Photo Upload State (Requirement 20)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // PDF Document Generation State (Requirement 13)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Template States (CRUD, Search, Bulk Upload)
  const [templateSubTab, setTemplateSubTab] = useState<'rx' | 'lab'>('rx');
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [newTemplateDisease, setNewTemplateDisease] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [isBulkTemplateOpen, setIsBulkTemplateOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);

  // Disease-Based Lab Test Template States
  const [labTemplateSearch, setLabTemplateSearch] = useState('');
  const [isSaveLabTemplateOpen, setIsSaveLabTemplateOpen] = useState(false);
  const [newLabTemplateDisease, setNewLabTemplateDisease] = useState('');
  const [newLabTemplateDescription, setNewLabTemplateDescription] = useState('');
  const [newLabTemplateTests, setNewLabTemplateTests] = useState<
    Array<{ name: string; code?: string; category?: string; price?: number; notes?: string }>
  >([{ name: '', code: '', category: 'Pathology', price: 0, notes: '' }]);
  const [editingLabTemplate, setEditingLabTemplate] = useState<any | null>(null);

  // Lab Request Modal States (Lab selection & multi-test requisition)
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState('');
  const [selectedCatalogTests, setSelectedCatalogTests] = useState<Array<{ name: string; code?: string; price: number; tatHours?: number }>>([]);
  const [customLabTest, setCustomLabTest] = useState('');
  const [customLabPrice, setCustomLabPrice] = useState<number>(0);
  const [labPriority, setLabPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [labNotes, setLabNotes] = useState('');

  // Consultation Clinical Data Form State (Requirement 10 & 12: No fake vitals, Chief complaints)
  const [diagnosis, setDiagnosis] = useState('');
  const [chiefComplaints, setChiefComplaints] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [examination, setExamination] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [vitals, setVitals] = useState({
    bp: '',
    pulse: '',
    temperature: '',
    weight: '',
    spo2: '',
  });

  // Section-level Save & Edit States for Consultation Vitals, Chief Complaints, and Examination
  const [isVitalsEditing, setIsVitalsEditing] = useState(true);
  const [savedVitalsSnapshot, setSavedVitalsSnapshot] = useState({ bp: '', pulse: '', temperature: '', weight: '', spo2: '' });
  const [vitalsLastSavedTime, setVitalsLastSavedTime] = useState<string | null>(null);
  const [isSavingVitals, setIsSavingVitals] = useState(false);

  const [isComplaintsEditing, setIsComplaintsEditing] = useState(true);
  const [savedComplaintsSnapshot, setSavedComplaintsSnapshot] = useState('');
  const [complaintsLastSavedTime, setComplaintsLastSavedTime] = useState<string | null>(null);
  const [isSavingComplaints, setIsSavingComplaints] = useState(false);

  const [isExaminationEditing, setIsExaminationEditing] = useState(true);
  const [savedExaminationSnapshot, setSavedExaminationSnapshot] = useState('');
  const [examinationLastSavedTime, setExaminationLastSavedTime] = useState<string | null>(null);
  const [isSavingExamination, setIsSavingExamination] = useState(false);
  const [medicines, setMedicines] = useState<MedicineItem[]>([
    {
      _id: 'med_init_1',
      name: '',
      dosage: '1 tablet',
      frequency: 'TDS (Thrice daily)',
      duration: '5 days',
      instructions: 'After food',
      priority: 1,
    },
  ]);

  // Dedicated Medicine Catalogue Dynamic Search State
  const [medicineSearchQuery, setMedicineSearchQuery] = useState('');
  const [isSearchingMedicines, setIsSearchingMedicines] = useState(false);
  const [medicineSearchResults, setMedicineSearchResults] = useState<MedicineCatalogItem[]>([]);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Leave Management State
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // Date filtering for OP bookings (Doctor can view OPs booked for today, tomorrow, next days, or completed)
  const [selectedDateFilter, setSelectedDateFilter] = useState<'TODAY' | 'TOMORROW' | 'NEXT_DAYS' | 'COMPLETED' | 'CUSTOM'>('TODAY');
  const [customDate, setCustomDate] = useState<string>('');
  const [doctorLabDateFilter, setDoctorLabDateFilter] = useState<string>('');
  const [isExportingCompletedExcel, setIsExportingCompletedExcel] = useState(false);

  const effectiveDateParam =
    selectedDateFilter === 'CUSTOM'
      ? customDate || undefined
      : selectedDateFilter;

  // Fetch appointments for this doctor (Today or Next Days)
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ['doctor-queue', effectiveDateParam],
    queryFn: () => doctorDashboardApi.getAppointments(effectiveDateParam),
    refetchInterval: 8000,
  });

  // Query upcoming appointments count for next days
  const { data: upcomingAppointments } = useQuery({
    queryKey: ['doctor-queue-upcoming-count'],
    queryFn: () => doctorDashboardApi.getAppointments('NEXT_DAYS'),
    refetchInterval: 20000,
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
  const { data: consultDetails, isLoading: isConsultDetailsLoading } = useQuery({
    queryKey: ['doctor-consult-details', activeAppointment?.id],
    queryFn: () => doctorDashboardApi.getConsultationDetails(activeAppointment!.id),
    enabled: !!activeAppointment && isConsultModalOpen,
  });

  // Reusable Disease-Based Prescription Templates
  const { data: templates } = useQuery({
    queryKey: ['doctor-templates'],
    queryFn: () => doctorDashboardApi.getTemplates(),
  });

  // Reusable Disease-Based Lab Test Templates
  const { data: labTemplates, refetch: refetchLabTemplates } = useQuery({
    queryKey: ['doctor-lab-templates'],
    queryFn: () => doctorDashboardApi.getLabTemplates(),
  });

  // Laboratory Test Requests
  const { data: labRequests, refetch: refetchLabRequests } = useQuery({
    queryKey: ['doctor-lab-requests'],
    queryFn: () => doctorDashboardApi.getLabRequests(),
    enabled: activeTab === 'labs',
  });

  // Registered hospital support staff query
  const { data: hospitalSupportStaff = [], isLoading: isLoadingSupportStaff } = useQuery({
    queryKey: ['doctor-hospital-support-staff'],
    queryFn: () => doctorDashboardApi.getHospitalSupportStaff(),
  });

  // Assign designated support staff mutation
  const assignSupportStaffMutation = useMutation({
    mutationFn: (assignedStaffId: string | null) => doctorDashboardApi.updateAssignedStaff(assignedStaffId),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['doctor-profile'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
      const staffName = data?.assignedStaff?.user?.name;
      toast.success(
        'Triage Nurse Updated',
        staffName
          ? `${staffName} is designated to record vitals for your patients exclusively.`
          : 'OPD appointments returned to general hospital nursing pool.'
      );
    },
    onError: (err: any) => {
      toast.error('Assignment Failed', err?.response?.data?.message || err?.message || 'Could not update designated staff');
    },
  });

  const handleAssignStaff = (staffId: string) => {
    assignSupportStaffMutation.mutate(staffId === '' ? null : staffId);
  };

  // Reset clinical state when active appointment changes (Requirement 10)
  useEffect(() => {
    if (!activeAppointment) {
      resetConsultationForm();
      setSaveStatus('idle');
      setLastSavedTime(null);
      return;
    }
    isRestoringDraftRef.current = true;
    setSaveStatus('idle');
    setLastSavedTime(null);
    setDiagnosis('');
    setChiefComplaints('');
    setSymptoms('');
    setExamination('');
    setClinicalNotes('');
    setFollowUpDate('');
    setSendToPharmacy(false);
    setVitals({ bp: '', pulse: '', temperature: '', weight: '', spo2: '' });
    setMedicines([
      {
        _id: `med_reset_${Date.now()}`,
        name: '',
        dosage: '1 tablet',
        frequency: 'TDS (Thrice daily)',
        duration: '5 days',
        instructions: 'After food',
        priority: 1,
      },
    ]);
    setMedicineSearchQuery('');
    setMedicineSearchResults([]);
    setIsSearchDropdownOpen(false);
    lastSavedSnapshotRef.current = '';

    // Reset section-level edit & snapshot states
    setIsVitalsEditing(true);
    setSavedVitalsSnapshot({ bp: '', pulse: '', temperature: '', weight: '', spo2: '' });
    setVitalsLastSavedTime(null);
    setIsSavingVitals(false);

    setIsComplaintsEditing(true);
    setSavedComplaintsSnapshot('');
    setComplaintsLastSavedTime(null);
    setIsSavingComplaints(false);

    setIsExaminationEditing(true);
    setSavedExaminationSnapshot('');
    setExaminationLastSavedTime(null);
    setIsSavingExamination(false);
  }, [activeAppointment?.id]);

  // Automatically pre-populate vitals, chief complaints, draft details, or existing prescription medicines when consultDetails are loaded
  useEffect(() => {
    if (!consultDetails || !activeAppointment) return;
    // CRITICAL: Ensure consultDetails belongs strictly to the CURRENT active encounter to prevent cross-contamination
    if (consultDetails.appointment?.id !== activeAppointment.id) return;

    isRestoringDraftRef.current = true;

    if (consultDetails.draft) {
      const d = consultDetails.draft;
      const cc = (d.chiefComplaints !== undefined && d.chiefComplaints !== null) ? d.chiefComplaints : '';
      setChiefComplaints(cc);
      setSavedComplaintsSnapshot(cc);
      setIsComplaintsEditing(cc.trim() === '');

      const ex = (d.examination !== undefined && d.examination !== null) ? d.examination : '';
      setExamination(ex);
      setSavedExaminationSnapshot(ex);
      setIsExaminationEditing(ex.trim() === '');

      if (d.diagnosis !== undefined && d.diagnosis !== null) {
        setDiagnosis(d.diagnosis);
      }
      if (d.clinicalNotes !== undefined && d.clinicalNotes !== null) {
        setClinicalNotes(d.clinicalNotes);
      }
      if (d.followUpDate !== undefined && d.followUpDate !== null) {
        setFollowUpDate(d.followUpDate);
      }
      setSendToPharmacy(Boolean(d.sendToPharmacy));

      let draftMedsRestored: MedicineItem[] = [];
      if (d.medicines) {
        try {
          const parsed = typeof d.medicines === 'string' ? JSON.parse(d.medicines) : d.medicines;
          if (Array.isArray(parsed) && parsed.length > 0) {
            draftMedsRestored = parsed.map((m: any, idx: number) => ({
              _id: m._id || `med_draft_${idx}_${Date.now()}`,
              name: m.name || '',
              dosage: m.dosage || '1 tablet',
              frequency: m.frequency || 'TDS (Thrice daily)',
              duration: m.duration || '5 days',
              instructions: m.instructions || 'After food',
              priority: typeof m.priority === 'number' && m.priority > 0 ? m.priority : idx + 1,
              isSubstituted: Boolean(m.isSubstituted),
              originalMedicine: m.originalMedicine,
              substitutionReason: m.substitutionReason,
            }));
            setMedicines(sortMedicinesByPriority(draftMedsRestored));
          }
        } catch {}
      }

      let restoredVitalsObj = { bp: '', pulse: '', temperature: '', weight: '', spo2: '' };
      let vitalsRestored = false;
      if (d.vitals) {
        try {
          const parsedV = typeof d.vitals === 'string' ? JSON.parse(d.vitals) : d.vitals;
          if (parsedV && (parsedV.bp || parsedV.pulse || parsedV.temperature || parsedV.weight || parsedV.spo2)) {
            restoredVitalsObj = {
              bp: parsedV.bp || '',
              pulse: parsedV.pulse || '',
              temperature: parsedV.temperature || '',
              weight: parsedV.weight || '',
              spo2: parsedV.spo2 || '',
            };
            setVitals(restoredVitalsObj);
            vitalsRestored = true;
          }
        } catch {}
      }

      if (!vitalsRestored) {
        const v = consultDetails.vitals || consultDetails.currentVitals;
        if (v) {
          const bpStr =
            formatBP(v.bloodPressure) ||
            formatSystolicDiastolicBP(v.bloodPressureSys || v.bpSystolic, v.bloodPressureDia || v.bpDiastolic) ||
            (v.bloodPressureSys ? formatBP(v.bloodPressureSys) : '');
          const pulseStr = v.pulseRate ? `${v.pulseRate} bpm` : v.pulse ? `${v.pulse} bpm` : '';
          const tempStr = v.temperature ? `${v.temperature}°F` : '';
          const weightStr = v.weightKg ? `${v.weightKg} kg` : v.weight ? `${v.weight} kg` : '';
          const spo2Str = v.spO2 || v.spo2 ? formatSpO2(v.spO2 || v.spo2) || '' : '';

          restoredVitalsObj = {
            bp: bpStr || '',
            pulse: pulseStr,
            temperature: tempStr,
            weight: weightStr,
            spo2: spo2Str,
          };
          setVitals(restoredVitalsObj);
        }
      }

      setSavedVitalsSnapshot(restoredVitalsObj);
      const hasAnyVital = Boolean(
        restoredVitalsObj.bp || restoredVitalsObj.pulse || restoredVitalsObj.temperature || restoredVitalsObj.weight || restoredVitalsObj.spo2
      );
      setIsVitalsEditing(!hasAnyVital);

      // Record saved snapshot baseline for unsaved changes tracking
      lastSavedSnapshotRef.current = JSON.stringify({
        diagnosis: (d.diagnosis || '').trim(),
        chiefComplaints: (d.chiefComplaints || '').trim(),
        examination: (d.examination || '').trim(),
        clinicalNotes: (d.clinicalNotes || '').trim(),
        followUpDate: (d.followUpDate || '').trim(),
        sendToPharmacy: Boolean(d.sendToPharmacy),
        vitals: {
          bp: (restoredVitalsObj.bp || '').trim(),
          pulse: (restoredVitalsObj.pulse || '').trim(),
          temperature: (restoredVitalsObj.temperature || '').trim(),
          weight: (restoredVitalsObj.weight || '').trim(),
          spo2: (restoredVitalsObj.spo2 || '').trim(),
        },
        medicines: draftMedsRestored.map((m) => ({
          name: (m.name || '').trim(),
          dosage: (m.dosage || '1 tablet').trim(),
          frequency: (m.frequency || 'TDS (Thrice daily)').trim(),
          duration: (m.duration || '5 days').trim(),
          instructions: (m.instructions || 'After food').trim(),
          priority: m.priority,
        })),
      });

      if (d.updatedAt) {
        const timeStr = new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSavedTime(timeStr);
        setVitalsLastSavedTime(timeStr);
        setComplaintsLastSavedTime(timeStr);
        setExaminationLastSavedTime(timeStr);
        setSaveStatus('saved');
      }
    } else {
      // No draft exists yet: Pre-populate existing records / prescription if reopened
      const cc = consultDetails.chiefComplaints || '';
      setChiefComplaints(cc);
      setSavedComplaintsSnapshot(cc);
      setIsComplaintsEditing(cc.trim() === '');

      const ex = consultDetails.examination || '';
      setExamination(ex);
      setSavedExaminationSnapshot(ex);
      setIsExaminationEditing(ex.trim() === '');

      let restoredMeds: MedicineItem[] = [];
      if (consultDetails.appointment?.prescription) {
        const rx = consultDetails.appointment.prescription;
        if (rx.diagnosis) setDiagnosis(rx.diagnosis);
        if (rx.instructions) setClinicalNotes(rx.instructions);
        if (rx.followUpDate) setFollowUpDate(rx.followUpDate);
        if (rx.items && rx.items.length > 0) {
          restoredMeds = rx.items.map((it: any, idx: number) => ({
            _id: `med_item_${it.id || idx}`,
            name: it.medicineName || it.name || '',
            dosage: it.dosage || '1 tablet',
            frequency: it.frequency || 'TDS (Thrice daily)',
            duration: it.duration || '5 days',
            instructions: it.instructions || 'After food',
            priority: typeof it.priority === 'number' && it.priority > 0 ? it.priority : idx + 1,
            isSubstituted: Boolean(it.isSubstituted),
            originalMedicine: it.originalMedicine,
            substitutionReason: it.substitutionReason,
          }));
          setMedicines(sortMedicinesByPriority(restoredMeds));
        } else if (rx.medicines) {
          try {
            const parsed = JSON.parse(rx.medicines);
            if (Array.isArray(parsed) && parsed.length > 0) {
              restoredMeds = parsed.map((m: any, idx: number) => ({
                _id: `med_restored_${idx}_${Date.now()}`,
                name: m.name || '',
                dosage: m.dosage || '1 tablet',
                frequency: m.frequency || 'TDS (Thrice daily)',
                duration: m.duration || '5 days',
                instructions: m.instructions || 'After food',
                priority: typeof m.priority === 'number' && m.priority > 0 ? m.priority : idx + 1,
                isSubstituted: Boolean(m.isSubstituted),
                originalMedicine: m.originalMedicine,
                substitutionReason: m.substitutionReason,
              }));
              setMedicines(sortMedicinesByPriority(restoredMeds));
            }
          } catch {}
        }
      }

      let restoredVitalsObj = { bp: '', pulse: '', temperature: '', weight: '', spo2: '' };
      const v = consultDetails.vitals || consultDetails.currentVitals;
      if (v) {
        const bpStr =
          formatBP(v.bloodPressure) ||
          formatSystolicDiastolicBP(v.bloodPressureSys || v.bpSystolic, v.bloodPressureDia || v.bpDiastolic) ||
          (v.bloodPressureSys ? formatBP(v.bloodPressureSys) : '');
        const pulseStr = v.pulseRate ? `${v.pulseRate} bpm` : v.pulse ? `${v.pulse} bpm` : '';
        const tempStr = v.temperature ? `${v.temperature}°F` : '';
        const weightStr = v.weightKg ? `${v.weightKg} kg` : v.weight ? `${v.weight} kg` : '';
        const spo2Str = v.spO2 || v.spo2 ? formatSpO2(v.spO2 || v.spo2) || '' : '';

        restoredVitalsObj = {
          bp: bpStr || '',
          pulse: pulseStr,
          temperature: tempStr,
          weight: weightStr,
          spo2: spo2Str,
        };
        setVitals(restoredVitalsObj);
      }

      setSavedVitalsSnapshot(restoredVitalsObj);
      const hasAnyVital = Boolean(
        restoredVitalsObj.bp || restoredVitalsObj.pulse || restoredVitalsObj.temperature || restoredVitalsObj.weight || restoredVitalsObj.spo2
      );
      setIsVitalsEditing(!hasAnyVital);

      // Record initial baseline snapshot
      const rx = consultDetails.appointment?.prescription;
      lastSavedSnapshotRef.current = JSON.stringify({
        diagnosis: (rx?.diagnosis || '').trim(),
        chiefComplaints: (consultDetails.chiefComplaints || '').trim(),
        examination: (consultDetails.examination || '').trim(),
        clinicalNotes: (rx?.instructions || '').trim(),
        followUpDate: (rx?.followUpDate || '').trim(),
        sendToPharmacy: false,
        vitals: {
          bp: (restoredVitalsObj.bp || '').trim(),
          pulse: (restoredVitalsObj.pulse || '').trim(),
          temperature: (restoredVitalsObj.temperature || '').trim(),
          weight: (restoredVitalsObj.weight || '').trim(),
          spo2: (restoredVitalsObj.spo2 || '').trim(),
        },
        medicines: restoredMeds.length > 0 ? restoredMeds.map((m) => ({
          name: (m.name || '').trim(),
          dosage: (m.dosage || '1 tablet').trim(),
          frequency: (m.frequency || 'TDS (Thrice daily)').trim(),
          duration: (m.duration || '5 days').trim(),
          instructions: (m.instructions || 'After food').trim(),
          priority: m.priority,
        })) : [
          {
            name: '',
            dosage: '1 tablet',
            frequency: 'TDS (Thrice daily)',
            duration: '5 days',
            instructions: 'After food',
            priority: 1,
          }
        ],
      });
    }

    const timer = setTimeout(() => {
      isRestoringDraftRef.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [consultDetails, activeAppointment?.id]);

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

  // Diagnostic Lab Test Template Mutations
  const createLabTemplateMutation = useMutation({
    mutationFn: (data: {
      diseaseName: string;
      description?: string;
      labTests: Array<{ name: string; code?: string; category?: string; price?: number; notes?: string }>;
    }) => doctorDashboardApi.createLabTemplate(data),
    onSuccess: () => {
      toast.success('Lab Template Saved', 'Lab test template added to your library');
      setIsSaveLabTemplateOpen(false);
      setNewLabTemplateDisease('');
      setNewLabTemplateDescription('');
      setNewLabTemplateTests([
        { name: '', code: '', category: 'Pathology', price: 0, notes: '' },
      ]);
      queryClient.invalidateQueries({ queryKey: ['doctor-lab-templates'] });
    },
    onError: (err: any) => {
      toast.error('Save Failed', err.response?.data?.message || err.message);
    },
  });

  const updateLabTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      doctorDashboardApi.updateLabTemplate(id, data),
    onSuccess: () => {
      toast.success('Lab Template Updated', 'Lab test template updated successfully');
      setEditingLabTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['doctor-lab-templates'] });
    },
    onError: (err: any) => {
      toast.error('Update Failed', err.response?.data?.message || err.message);
    },
  });

  const deleteLabTemplateMutation = useMutation({
    mutationFn: (templateId: string) => doctorDashboardApi.deleteLabTemplate(templateId),
    onSuccess: () => {
      toast.success('Lab Template Deleted', 'Lab test template removed from library');
      queryClient.invalidateQueries({ queryKey: ['doctor-lab-templates'] });
    },
    onError: (err: any) => {
      toast.error('Delete Failed', err.response?.data?.message || err.message);
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
      lastSavedSnapshotRef.current = '';
      setIsConsultModalOpen(false);
      setActiveAppointment(null);
      resetConsultationForm();
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    },
    onError: (err: any) => {
      toast.error('Failed to complete consultation', err.message);
    },
  });

  // Save consultation changes / draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: (data: { appointmentId: string; payload: any; silent?: boolean }) =>
      doctorDashboardApi.saveDraftConsultation(data.appointmentId, data.payload),
    onSuccess: (_data: any, variables: any) => {
      lastSavedSnapshotRef.current = getFormSnapshot();
      setSaveStatus('saved');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(timeStr);
      setVitalsLastSavedTime(timeStr);
      setComplaintsLastSavedTime(timeStr);
      setExaminationLastSavedTime(timeStr);
      setSavedVitalsSnapshot({ ...vitals });
      setSavedComplaintsSnapshot((chiefComplaints || '').trim());
      setSavedExaminationSnapshot((examination || '').trim());
      if (vitals.bp || vitals.pulse || vitals.temperature || vitals.weight || vitals.spo2) {
        setIsVitalsEditing(false);
      }
      if ((chiefComplaints || '').trim()) {
        setIsComplaintsEditing(false);
      }
      if ((examination || '').trim()) {
        setIsExaminationEditing(false);
      }
      if (!variables?.silent) {
        toast.success('Changes Saved', 'All clinical consultation changes have been saved to the database.');
      }
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-consult-details', activeAppointment?.id] });
    },
    onError: (err: any, variables: any) => {
      setSaveStatus('error');
      if (!variables?.silent) {
        toast.error('Failed to Save Changes', err.message || 'Could not save consultation changes');
      }
    },
  });

  const getFormSnapshot = () => {
    return JSON.stringify({
      diagnosis: (diagnosis || '').trim(),
      chiefComplaints: (chiefComplaints || '').trim(),
      examination: (examination || '').trim(),
      clinicalNotes: (clinicalNotes || '').trim(),
      followUpDate: (followUpDate || '').trim(),
      sendToPharmacy: Boolean(sendToPharmacy),
      vitals: {
        bp: (vitals.bp || '').trim(),
        pulse: (vitals.pulse || '').trim(),
        temperature: (vitals.temperature || '').trim(),
        weight: (vitals.weight || '').trim(),
        spo2: (vitals.spo2 || '').trim(),
      },
      medicines: (medicines || []).map((m) => ({
        name: (m.name || '').trim(),
        dosage: (m.dosage || '').trim(),
        frequency: (m.frequency || '').trim(),
        duration: (m.duration || '').trim(),
        instructions: (m.instructions || '').trim(),
        priority: typeof m.priority === 'number' && m.priority > 0 ? m.priority : null,
      })),
    });
  };

  // Helper to check if the consultation contains any entered clinical data
  const hasEnteredConsultationData = () => {
    if ((diagnosis || '').trim().length > 0) return true;
    if ((chiefComplaints || '').trim().length > 0) return true;
    if ((symptoms || '').trim().length > 0) return true;
    if ((examination || '').trim().length > 0) return true;
    if ((clinicalNotes || '').trim().length > 0) return true;
    if ((followUpDate || '').trim().length > 0) return true;
    if (
      (vitals.bp || '').trim().length > 0 ||
      (vitals.pulse || '').trim().length > 0 ||
      (vitals.temperature || '').trim().length > 0 ||
      (vitals.weight || '').trim().length > 0 ||
      (vitals.spo2 || '').trim().length > 0
    ) {
      return true;
    }
    if ((medicines || []).some((m) => m.name && m.name.trim().length > 0)) {
      return true;
    }
    return false;
  };

  // Automatic debounced draft persistence for active consultation encounter (30-second inactivity rule)
  useEffect(() => {
    if (!isConsultModalOpen || !activeAppointment || isRestoringDraftRef.current) {
      return;
    }
    if (!lastSavedSnapshotRef.current) {
      return;
    }

    const currentSnapshot = getFormSnapshot();
    if (currentSnapshot === lastSavedSnapshotRef.current) {
      // Form matches the last saved state
      if (saveStatus === 'unsaved') {
        setSaveStatus(lastSavedTime ? 'saved' : 'idle');
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    // Auto-save only when the consultation contains data and has unsaved changes
    if (!hasEnteredConsultationData()) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    // There are unsaved changes. Do NOT trigger auto-save immediately.
    // Display 'unsaved' state and reset the 30-second inactivity timer.
    setSaveStatus('unsaved');

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    const currentApptId = activeAppointment.id;

    // Wait until the doctor stops typing for 30 seconds before triggering auto-save
    autoSaveTimerRef.current = setTimeout(() => {
      // Ensure the consultation modal is still open and for the exact same OP
      if (!isConsultModalOpen || !activeAppointment || activeAppointment.id !== currentApptId) {
        return;
      }

      // Prevent duplicate or overlapping save requests
      if (saveDraftMutation.isPending) {
        return;
      }

      const latestSnapshot = getFormSnapshot();
      if (latestSnapshot === lastSavedSnapshotRef.current) {
        setSaveStatus('saved');
        return;
      }

      if (!hasEnteredConsultationData()) {
        return;
      }

      // Trigger auto-save after 30 seconds of typing inactivity
      setSaveStatus('saving');

      const payload = {
        diagnosis: diagnosis.trim() || undefined,
        chiefComplaints: chiefComplaints.trim() || undefined,
        symptoms: chiefComplaints.trim() || symptoms.trim() || undefined,
        examination: examination.trim() || undefined,
        clinicalNotes: clinicalNotes.trim() || undefined,
        followUpDate: followUpDate.trim() || undefined,
        sendToPharmacy,
        vitals: {
          bp: vitals.bp.trim() || undefined,
          pulse: vitals.pulse.trim() || undefined,
          temperature: vitals.temperature.trim() || undefined,
          weight: vitals.weight.trim() || undefined,
          spo2: vitals.spo2.trim() || undefined,
        },
        medicines: medicines
          .filter((m) => m.name && m.name.trim().length > 0)
          .map((m, idx) => ({
            name: m.name.trim(),
            dosage: m.dosage.trim() || '1 tablet',
            frequency: m.frequency.trim() || 'TDS (Thrice daily)',
            duration: m.duration.trim() || '5 days',
            instructions: m.instructions.trim() || 'After food',
            priority: typeof m.priority === 'number' && m.priority > 0 ? m.priority : idx + 1,
            isSubstituted: m.isSubstituted,
            originalMedicine: m.originalMedicine,
            substitutionReason: m.substitutionReason,
          })),
        labRequests: consultDetails?.appointment?.labRequests || [],
      };

      saveDraftMutation.mutate({
        appointmentId: currentApptId,
        payload,
        silent: true,
      });
    }, 30000); // 30 seconds debounce timer

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    isConsultModalOpen,
    activeAppointment?.id,
    diagnosis,
    chiefComplaints,
    symptoms,
    examination,
    clinicalNotes,
    followUpDate,
    sendToPharmacy,
    vitals,
    medicines,
  ]);

  const handleSaveChanges = async () => {
    if (!activeAppointment) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setSaveStatus('saving');

    const payload = {
      diagnosis: diagnosis.trim() || undefined,
      chiefComplaints: chiefComplaints.trim() || undefined,
      symptoms: chiefComplaints.trim() || symptoms.trim() || undefined,
      examination: examination.trim() || undefined,
      clinicalNotes: clinicalNotes.trim() || undefined,
      followUpDate: followUpDate.trim() || undefined,
      sendToPharmacy,
      vitals: {
        bp: vitals.bp.trim() || undefined,
        pulse: vitals.pulse.trim() || undefined,
        temperature: vitals.temperature.trim() || undefined,
        weight: vitals.weight.trim() || undefined,
        spo2: vitals.spo2.trim() || undefined,
      },
      medicines: medicines.map((m, idx) => ({
        name: m.name.trim(),
        dosage: m.dosage.trim() || '1 tablet',
        frequency: m.frequency.trim() || 'TDS (Thrice daily)',
        duration: m.duration.trim() || '5 days',
        instructions: m.instructions.trim() || 'After food',
        priority: typeof m.priority === 'number' && m.priority > 0 ? m.priority : idx + 1,
        isSubstituted: m.isSubstituted,
        originalMedicine: m.originalMedicine,
        substitutionReason: m.substitutionReason,
      })),
      labRequests: consultDetails?.appointment?.labRequests || [],
    };

    return saveDraftMutation.mutateAsync({
      appointmentId: activeAppointment.id,
      payload,
      silent: false,
    });
  };

  const handleSaveDraft = handleSaveChanges;

  // Section 1: Consultation Vitals Handlers & Indicators
  const hasSavedVitals = Boolean(
    savedVitalsSnapshot.bp ||
    savedVitalsSnapshot.pulse ||
    savedVitalsSnapshot.temperature ||
    savedVitalsSnapshot.weight ||
    savedVitalsSnapshot.spo2
  );

  const isVitalsModified =
    (vitals.bp || '').trim() !== (savedVitalsSnapshot.bp || '').trim() ||
    (vitals.pulse || '').trim() !== (savedVitalsSnapshot.pulse || '').trim() ||
    (vitals.temperature || '').trim() !== (savedVitalsSnapshot.temperature || '').trim() ||
    (vitals.weight || '').trim() !== (savedVitalsSnapshot.weight || '').trim() ||
    (vitals.spo2 || '').trim() !== (savedVitalsSnapshot.spo2 || '').trim();

  const handleSaveVitals = async () => {
    if (!activeAppointment) return;
    setIsSavingVitals(true);
    try {
      const payload = {
        vitals: {
          bp: vitals.bp.trim() || undefined,
          pulse: vitals.pulse.trim() || undefined,
          temperature: vitals.temperature.trim() || undefined,
          weight: vitals.weight.trim() || undefined,
          spo2: vitals.spo2.trim() || undefined,
        },
      };
      await doctorDashboardApi.saveDraftConsultation(activeAppointment.id, payload);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSavedVitalsSnapshot({ ...vitals });
      setIsVitalsEditing(false);
      setVitalsLastSavedTime(timeStr);
      setLastSavedTime(timeStr);
      toast.success('Consultation Vitals Saved', 'Vitals have been persisted to the database.');
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-consult-details', activeAppointment.id] });
    } catch (err: any) {
      toast.error('Failed to Save Vitals', err?.response?.data?.message || err.message || 'Could not save vitals');
    } finally {
      setIsSavingVitals(false);
    }
  };

  const handleCancelVitals = () => {
    setVitals({ ...savedVitalsSnapshot });
    if (hasSavedVitals) {
      setIsVitalsEditing(false);
    }
    toast.info('Changes Discarded', 'Consultation vitals restored to last saved values.');
  };

  // Section 2: Chief Complaints Handlers & Indicators
  const hasSavedComplaints = Boolean(savedComplaintsSnapshot.trim());
  const isComplaintsModified = chiefComplaints.trim() !== savedComplaintsSnapshot.trim();

  const handleSaveComplaints = async () => {
    if (!activeAppointment) return;
    setIsSavingComplaints(true);
    try {
      const payload = {
        chiefComplaints: chiefComplaints.trim() || undefined,
        symptoms: chiefComplaints.trim() || symptoms.trim() || undefined,
      };
      await doctorDashboardApi.saveDraftConsultation(activeAppointment.id, payload);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSavedComplaintsSnapshot(chiefComplaints.trim());
      setIsComplaintsEditing(false);
      setComplaintsLastSavedTime(timeStr);
      setLastSavedTime(timeStr);
      toast.success('Chief Complaints Saved', 'Chief complaints have been persisted to the database.');
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-consult-details', activeAppointment.id] });
    } catch (err: any) {
      toast.error('Failed to Save Complaints', err?.response?.data?.message || err.message || 'Could not save chief complaints');
    } finally {
      setIsSavingComplaints(false);
    }
  };

  const handleCancelComplaints = () => {
    setChiefComplaints(savedComplaintsSnapshot);
    if (hasSavedComplaints) {
      setIsComplaintsEditing(false);
    }
    toast.info('Changes Discarded', 'Chief complaints restored to last saved values.');
  };

  // Section 3: Examination Handlers & Indicators
  const hasSavedExamination = Boolean(savedExaminationSnapshot.trim());
  const isExaminationModified = examination.trim() !== savedExaminationSnapshot.trim();

  const handleSaveExamination = async () => {
    if (!activeAppointment) return;
    setIsSavingExamination(true);
    try {
      const payload = {
        examination: examination.trim() || undefined,
      };
      await doctorDashboardApi.saveDraftConsultation(activeAppointment.id, payload);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSavedExaminationSnapshot(examination.trim());
      setIsExaminationEditing(false);
      setExaminationLastSavedTime(timeStr);
      setLastSavedTime(timeStr);
      toast.success('Examination Saved', 'Clinical examination findings have been persisted to the database.');
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-consult-details', activeAppointment.id] });
    } catch (err: any) {
      toast.error('Failed to Save Examination', err?.response?.data?.message || err.message || 'Could not save examination findings');
    } finally {
      setIsSavingExamination(false);
    }
  };

  const handleCancelExamination = () => {
    setExamination(savedExaminationSnapshot);
    if (hasSavedExamination) {
      setIsExaminationEditing(false);
    }
    toast.info('Changes Discarded', 'Clinical examination findings restored to last saved values.');
  };

  // Keyboard shortcut Ctrl+S / Cmd+S to save consultation changes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        if (isConsultModalOpen && activeAppointment) {
          e.preventDefault();
          handleSaveChanges();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isConsultModalOpen,
    activeAppointment?.id,
    diagnosis,
    chiefComplaints,
    examination,
    clinicalNotes,
    followUpDate,
    sendToPharmacy,
    vitals,
    medicines,
    consultDetails,
  ]);

  const handleRequestCloseConsultModal = () => {
    const currentSnapshot = getFormSnapshot();
    if (lastSavedSnapshotRef.current && currentSnapshot !== lastSavedSnapshotRef.current) {
      setPendingSwitchAppointment(null);
      setIsUnsavedWarningOpen(true);
    } else {
      setIsConsultModalOpen(false);
      setActiveAppointment(null);
      setPendingSwitchAppointment(null);
      resetConsultationForm();
    }
  };

  const handleConfirmDiscard = () => {
    setIsUnsavedWarningOpen(false);
    if (pendingSwitchAppointment) {
      const nextApt = pendingSwitchAppointment;
      setPendingSwitchAppointment(null);
      setActiveAppointment(nextApt);
      setIsConsultModalOpen(true);
    } else {
      setIsConsultModalOpen(false);
      setActiveAppointment(null);
      setPendingSwitchAppointment(null);
      resetConsultationForm();
    }
  };

  const handleSaveAndSwitch = async () => {
    setIsUnsavedWarningOpen(false);
    await handleSaveDraft();
    if (pendingSwitchAppointment) {
      const nextApt = pendingSwitchAppointment;
      setPendingSwitchAppointment(null);
      setActiveAppointment(nextApt);
      setIsConsultModalOpen(true);
    }
  };

  // Warn on browser tab close/refresh if consultation form has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isConsultModalOpen && lastSavedSnapshotRef.current && getFormSnapshot() !== lastSavedSnapshotRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    isConsultModalOpen,
    diagnosis,
    chiefComplaints,
    examination,
    clinicalNotes,
    followUpDate,
    sendToPharmacy,
    vitals,
    medicines,
  ]);

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
    setChiefComplaints('');
    setSymptoms('');
    setExamination('');
    setClinicalNotes('');
    setFollowUpDate('');
    setSendToPharmacy(false);
    setVitals({
      bp: '',
      pulse: '',
      temperature: '',
      weight: '',
      spo2: '',
    });
    setMedicines([
      {
        _id: `med_init_${Date.now()}`,
        name: '',
        dosage: '1 tablet',
        frequency: 'TDS (Thrice daily)',
        duration: '5 days',
        instructions: 'After food',
        priority: 1,
      },
    ]);
    setMedicineSearchQuery('');
    setMedicineSearchResults([]);
    setIsSearchDropdownOpen(false);
    lastSavedSnapshotRef.current = '';

    setIsVitalsEditing(true);
    setSavedVitalsSnapshot({ bp: '', pulse: '', temperature: '', weight: '', spo2: '' });
    setVitalsLastSavedTime(null);
    setIsSavingVitals(false);

    setIsComplaintsEditing(true);
    setSavedComplaintsSnapshot('');
    setComplaintsLastSavedTime(null);
    setIsSavingComplaints(false);

    setIsExaminationEditing(true);
    setSavedExaminationSnapshot('');
    setExaminationLastSavedTime(null);
    setIsSavingExamination(false);
  };

  // Download Clinical Consultation Summary PDF (Requirement 13)
  const handleDownloadConsultationPdf = async (appointmentId: string, patientName?: string) => {
    try {
      setIsDownloadingPdf(true);
      toast.info('Generating PDF', 'Compiling official clinical consultation document...');
      const blob = await doctorDashboardApi.downloadConsultationPdf(appointmentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Consultation-${(patientName || 'Patient').replace(/\s+/g, '_')}-${appointmentId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Downloaded', 'Clinical consultation document downloaded successfully.');
    } catch (err: any) {
      toast.error('Download Failed', err.message || 'Could not download consultation document');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Print Clinical Consultation PDF with 2-inch top margin for Hospital Letterhead
  const handlePrintConsultationPdf = async (appointmentId: string) => {
    try {
      setIsDownloadingPdf(true);
      toast.info('Preparing Print Document', 'Generating consultation document with 2-inch hospital letterhead space...');
      const blob = await doctorDashboardApi.downloadConsultationPdf(appointmentId);
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        // Fall back to opening direct link
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      toast.success('Print Document Ready', 'Consultation document opened. Ready to print on hospital letterhead.');
    } catch (err: any) {
      toast.error('Print Failed', err.message || 'Could not prepare print document');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Profile Photo Upload & Remove (Requirement 20)
  const handleProfilePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid Format', 'Please upload an image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File Exceeds Limit', 'Maximum allowed image size is 5MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const result = await uploadApi.uploadProfilePhoto(base64Data);
          updateUser({ avatarUrl: result.url });
          refetchProfile();
          toast.success('Profile Photo Updated', 'Your doctor avatar has been updated successfully.');
        } catch (err: any) {
          toast.error('Upload Failed', err.message || 'Could not upload photo');
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      reader.onerror = () => {
        toast.error('Upload Failed', 'Error reading image file');
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error('Upload Failed', err.message);
      setIsUploadingPhoto(false);
    }
  };

  const handleProfilePhotoRemove = async () => {
    if (!window.confirm('Remove doctor profile photo?')) return;
    setIsUploadingPhoto(true);
    try {
      await uploadApi.removeProfilePhoto();
      updateUser({ avatarUrl: null });
      refetchProfile();
      toast.success('Photo Removed', 'Profile avatar reset to default.');
    } catch (err: any) {
      toast.error('Removal Failed', err.message || 'Could not remove photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Close medicine search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced medicine catalogue search effect
  useEffect(() => {
    const q = medicineSearchQuery.trim();
    if (!q) {
      setMedicineSearchResults([]);
      setIsSearchingMedicines(false);
      setIsSearchDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingMedicines(true);
        const results = await doctorDashboardApi.searchMedicines(q);
        setMedicineSearchResults(results || []);
        setIsSearchDropdownOpen(true);
      } catch (err) {
        console.error('Failed to search medicines:', err);
      } finally {
        setIsSearchingMedicines(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [medicineSearchQuery]);

  const handleSelectMedicineFromSearch = (item: MedicineCatalogItem) => {
    // Check for duplicate in current prescription
    const existingIndex = medicines.findIndex(
      (m) => m.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    );

    if (existingIndex !== -1) {
      toast.info(
        'Medicine Already Added',
        `"${item.name}" is already in this prescription (Item #${existingIndex + 1}). You can edit its individual dosage or frequency directly below.`
      );
      return;
    }

    const existingPriorities = medicines
      .map((m) => (typeof m.priority === 'number' && m.priority > 0 ? m.priority : 0))
      .filter((p) => p > 0);
    const nextPriority = existingPriorities.length > 0 ? Math.max(...existingPriorities) + 1 : medicines.length + 1;

    const newMed: MedicineItem = {
      _id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: item.name,
      dosage: item.defaultDosage || '1 tablet',
      frequency: item.defaultFrequency || 'BD (Twice daily)',
      duration: item.defaultDuration || '5 days',
      instructions: item.defaultInstructions || 'After food',
      priority: nextPriority,
    };

    // If there is only 1 empty medicine row in the list, replace it
    if (medicines.length === 1 && !medicines[0].name.trim()) {
      setMedicines([newMed]);
    } else {
      setMedicines(sortMedicinesByPriority([...medicines, newMed]));
    }

    toast.success('Medicine Added', `"${item.name}" added to prescription.`);
    setMedicineSearchQuery('');
    setIsSearchDropdownOpen(false);
  };

  const addMedicine = () => {
    const existingPriorities = medicines
      .map((m) => (typeof m.priority === 'number' && m.priority > 0 ? m.priority : 0))
      .filter((p) => p > 0);
    const nextPriority = existingPriorities.length > 0 ? Math.max(...existingPriorities) + 1 : medicines.length + 1;

    const newMed: MedicineItem = {
      _id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: '',
      dosage: '1 tablet',
      frequency: 'BD (Twice daily)',
      duration: '5 days',
      instructions: 'After meals',
      priority: nextPriority,
    };
    setMedicines(sortMedicinesByPriority([...medicines, newMed]));
  };

  const removeMedicine = (idOrIndex: string | number) => {
    setMedicines((prev) => {
      const filtered = typeof idOrIndex === 'string'
        ? prev.filter((m) => m._id !== idOrIndex)
        : prev.filter((_, i) => i !== idOrIndex);
      return filtered.length > 0 ? filtered : [
        {
          _id: `med_fallback_${Date.now()}`,
          name: '',
          dosage: '1 tablet',
          frequency: 'TDS (Thrice daily)',
          duration: '5 days',
          instructions: 'After food',
          priority: 1,
        },
      ];
    });
  };

  const handleMedicinePriorityChange = (medId: string, rawVal: string) => {
    if (rawVal === '') {
      setMedicines((prev) =>
        prev.map((m) => (m._id === medId ? { ...m, priority: '' as any } : m))
      );
      return;
    }
    const parsed = parseInt(rawVal, 10);
    if (isNaN(parsed) || parsed < 1) {
      return;
    }
    setMedicines((prev) => {
      const updated = prev.map((m) => (m._id === medId ? { ...m, priority: parsed } : m));
      return sortMedicinesByPriority(updated);
    });
  };

  const handleMedicinePriorityBlur = (medId: string) => {
    setMedicines((prev) => {
      const updated = prev.map((m, idx) => {
        if (m._id === medId) {
          const validPriority =
            typeof m.priority === 'number' && !isNaN(m.priority) && m.priority > 0
              ? m.priority
              : idx + 1;
          return { ...m, priority: validPriority };
        }
        return m;
      });
      return sortMedicinesByPriority(updated);
    });
  };

  const updateMedicine = (idOrIndex: string | number, field: keyof MedicineItem, val: string) => {
    setMedicines((prev) =>
      prev.map((m, idx) => {
        const matches = typeof idOrIndex === 'string' ? m._id === idOrIndex : idx === idOrIndex;
        return matches ? { ...m, [field]: val } : m;
      })
    );
  };

  const handleOpenConsultModal = (apt: Appointment) => {
    if (isConsultModalOpen && activeAppointment && activeAppointment.id !== apt.id) {
      const currentSnapshot = getFormSnapshot();
      if (lastSavedSnapshotRef.current && currentSnapshot !== lastSavedSnapshotRef.current) {
        setPendingSwitchAppointment(apt);
        setIsUnsavedWarningOpen(true);
        return;
      }
    }
    setActiveAppointment(apt);
    setIsConsultModalOpen(true);
  };

  // Find currently consulting patient
  const inConsultationPatient = (appointments || []).find(
    (a) => a.status === 'IN_CONSULTATION'
  );

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const blob = await doctorDashboardApi.exportAllDataExcel();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const safeDoctorName = (profile?.user?.name || user?.name || 'Doctor').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `MedPulse_Doctor_${safeDoctorName}_AllData_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Excel Export Successful', 'All doctor records (OP Queue, Templates, Labs, Schedules, Leaves) exported to Excel (.xlsx)');
    } catch (err: any) {
      toast.error('Excel Export Failed', err.message || 'Could not export Excel file');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCompletedExcel = async () => {
    setIsExportingCompletedExcel(true);
    try {
      const blob = await doctorDashboardApi.exportAllDataExcel({ status: 'COMPLETED' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const safeDoctorName = (profile?.user?.name || user?.name || 'Doctor').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `MedPulse_Doctor_${safeDoctorName}_Completed_Consultations_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Completed Consultations Exported', 'Completed OPD consultations exported to Excel (.xlsx)');
    } catch (err: any) {
      toast.error('Export Failed', err.message || 'Could not export completed consultations');
    } finally {
      setIsExportingCompletedExcel(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title & Actions - Navigation is cleanly hosted in Left Sidebar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'queue' && "Today's OPD Consultation Room"}
              {activeTab === 'templates' && "Clinical Prescription Templates"}
              {activeTab === 'labs' && "Diagnostic Laboratory Requisitions"}
              {activeTab === 'roster' && "Doctor Practice Roster & Timings"}
              {activeTab === 'leaves' && "Doctor Leave & Absence Calendar"}
              {activeTab === 'profile' && "Doctor Profile & Registration Details"}
              {activeTab === 'branding' && "Consultation Letterhead & Branding"}
            </h1>
            <Badge variant="success" className="text-[11px] font-bold">
              OPD Active
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'queue' && "Manage today's patient token queue, initiate clinical consultations, and dispense e-prescriptions"}
            {activeTab === 'templates' && "Manage reusable disease medication templates for faster consultation dispensing"}
            {activeTab === 'labs' && "Track patient laboratory investigation requests, statuses, and completed reports"}
            {activeTab === 'roster' && "Configure OPD consultation schedules, slot durations, and hospital practice hours"}
            {activeTab === 'leaves' && "Submit leave requests and view upcoming duty off days"}
            {activeTab === 'profile' && "Update your personal, contact, clinical credentials, consultation settings, and account password"}
            {activeTab === 'branding' && "Configure custom doctor header and footer banners for clinical consultation PDFs"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'queue' && (
            <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0 text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <Users className="w-3.5 h-3.5 text-royal-600" />
              Refresh Queue ({(appointments || []).length})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="shrink-0 text-xs font-bold flex items-center gap-1.5 shadow-sm border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400"
            title="Export all doctor data to Excel (.xlsx) including Queue, Templates, Labs, Schedules, and Leaves"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            {isExportingExcel ? 'Exporting...' : 'Export to Excel (.xlsx)'}
          </Button>
        </div>
      </div>

      {/* TAB 1: OPD QUEUE */}
      {activeTab === 'queue' && (
        <>
          {/* DESIGNATED SUPPORT STAFF (TRIAGE NURSE) SELECTION CARD */}
          <div className="bg-gradient-to-r from-teal-50/80 via-emerald-50/40 to-white border border-teal-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-sm shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-black text-slate-900 tracking-tight">
                      Designated Support Staff (Triage & Vitals)
                    </h2>
                    {profile?.assignedStaff ? (
                      <Badge variant="success" className="text-[10px] font-bold">
                        Exclusively Assigned: {profile.assignedStaff.user?.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-semibold text-slate-500">
                        Hospital General Pool
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a support staff member from your hospital to record pre-consultation vitals. Patient tokens (OPs) booked for your OPD will be routed exclusively to them.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:self-center">
                <div className="relative">
                  <select
                    id="doctor-support-staff-select"
                    value={profile?.assignedStaffId || ''}
                    onChange={(e) => handleAssignStaff(e.target.value)}
                    disabled={assignSupportStaffMutation.isPending || isLoadingSupportStaff}
                    className="text-xs font-semibold px-3 py-2 bg-white border border-teal-300 rounded-xl shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[240px] disabled:opacity-60 cursor-pointer"
                  >
                    <option value="">General Hospital Pool (Any Registered Nurse)</option>
                    {(hospitalSupportStaff || []).map((staff: any) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.user?.name || 'Staff Member'} — {staff.roleTitle || 'Nurse'} {staff.department?.name ? `(${staff.department.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {profile?.assignedStaffId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignStaff('')}
                    disabled={assignSupportStaffMutation.isPending}
                    className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 hover:border-rose-400 hover:text-rose-800 shadow-sm flex items-center gap-1.5"
                    title="Remove assignment and return to general nursing pool"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Reset to Pool
                  </Button>
                )}

                {assignSupportStaffMutation.isPending && (
                  <div className="flex items-center gap-1.5 text-xs text-teal-700 font-semibold">
                    <InlineSpinner size="sm" />
                    <span>Updating...</span>
                  </div>
                )}
              </div>
            </div>

            {profile?.assignedStaff && (
              <div className="pt-2 border-t border-teal-100 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="font-semibold text-teal-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  Assigned Nurse: <strong className="text-slate-900">{profile.assignedStaff.user?.name}</strong>
                </span>
                <span>•</span>
                <span>Role: {profile.assignedStaff.roleTitle || 'Triage / Screening Nurse'}</span>
                {profile.assignedStaff.user?.phone && (
                  <>
                    <span>•</span>
                    <span>Phone: +91 {profile.assignedStaff.user.phone}</span>
                  </>
                )}
                {profile.assignedStaff.user?.email && (
                  <>
                    <span>•</span>
                    <span>Email: {profile.assignedStaff.user.email}</span>
                  </>
                )}
              </div>
            )}
          </div>

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
                <span>Blood Group: {inConsultationPatient.patient.bloodGroup || 'Not specified'}</span>
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

      {/* OPD QUEUE & UPCOMING BOOKINGS */}
      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
        {/* Date Filter & View Selector Banner */}
        <div className="bg-white border-b border-slate-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Schedule View:
              </span>
              <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter('TODAY')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedDateFilter === 'TODAY'
                      ? 'bg-royal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Today's OPs
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter('TOMORROW')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedDateFilter === 'TOMORROW'
                      ? 'bg-royal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter('NEXT_DAYS')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    selectedDateFilter === 'NEXT_DAYS'
                      ? 'bg-royal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Next Days (All Upcoming)</span>
                  {(upcomingAppointments?.length || 0) > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        selectedDateFilter === 'NEXT_DAYS'
                          ? 'bg-white text-royal-700'
                          : 'bg-royal-100 text-royal-700'
                      }`}
                    >
                      {upcomingAppointments?.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter('COMPLETED')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedDateFilter === 'COMPLETED'
                      ? 'bg-royal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Completed OPs
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCompletedExcel}
              disabled={isExportingCompletedExcel}
              className="text-xs text-teal-800 bg-teal-50 border-teal-300 hover:bg-teal-100 font-bold flex items-center gap-1.5 whitespace-nowrap shadow-xs"
              title="Export completed consultations to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
              {isExportingCompletedExcel ? 'Exporting...' : 'Export Completed (.xlsx)'}
            </Button>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-royal-600" />
              <span className="text-slate-500 font-medium">Select Date:</span>
              <input
                type="date"
                value={selectedDateFilter === 'CUSTOM' ? customDate : ''}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setSelectedDateFilter('CUSTOM');
                }}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
              />
            </div>
            {selectedDateFilter !== 'TODAY' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDateFilter('TODAY')}
                className="text-xs text-royal-600 hover:text-royal-800 hover:bg-royal-50 font-bold"
              >
                Reset to Today
              </Button>
            )}
          </div>
        </div>

        {/* Card Header displaying title and counts */}
        <CardHeader className="bg-slate-50/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-royal-600" />
            {selectedDateFilter === 'TODAY' && `Today's OPD Queue (${(appointments || []).length} Total Booked)`}
            {selectedDateFilter === 'TOMORROW' && `Tomorrow's Booked OPs (${(appointments || []).length} Scheduled)`}
            {selectedDateFilter === 'NEXT_DAYS' && `Upcoming OP Bookings for Next Days (${(appointments || []).length} Scheduled)`}
            {selectedDateFilter === 'COMPLETED' && `Completed OPD Consultations (${(appointments || []).length} Consulted)`}
            {selectedDateFilter === 'CUSTOM' && `Booked OPs for ${customDate} (${(appointments || []).length} Scheduled)`}
          </CardTitle>

          <div className="flex gap-2 text-xs font-semibold">
            {selectedDateFilter === 'TODAY' ? (
              <>
                <span className="text-royal-700">
                  {(appointments || []).filter((a) => a.status === 'COMPLETED').length} Completed
                </span>
                <span>•</span>
                <span className="text-amber-600">
                  {(appointments || []).filter((a) => a.status === 'DRAFT').length} Draft
                </span>
                <span>•</span>
                <span className="text-gold-600">
                  {(appointments || []).filter((a) => a.status === 'WAITING' || a.status === 'CONFIRMED').length} Waiting
                </span>
              </>
            ) : selectedDateFilter === 'COMPLETED' ? (
              <Badge variant="success" className="text-[11px] font-bold">
                Completed Records
              </Badge>
            ) : (
              <Badge variant="purple" className="text-[11px] font-bold">
                Upcoming Pre-Booked Tokens
              </Badge>
            )}
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Token</th>
                {selectedDateFilter !== 'TODAY' && (
                  <th className="px-5 py-3.5">Scheduled Date</th>
                )}
                <th className="px-5 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Slot Time</th>
                <th className="px-5 py-3.5">OP Number</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Follow-up Date</th>
                <th className="px-5 py-3.5 text-right">OPD Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={selectedDateFilter !== 'TODAY' ? 8 : 7} className="text-center py-10 text-slate-400">
                    Loading doctor queue...
                  </td>
                </tr>
              ) : !appointments || appointments.length === 0 ? (
                <tr>
                  <td colSpan={selectedDateFilter !== 'TODAY' ? 8 : 7} className="text-center py-12 text-slate-400">
                    {selectedDateFilter === 'TODAY'
                      ? 'No appointments booked for today.'
                      : selectedDateFilter === 'TOMORROW'
                      ? 'No appointments booked for tomorrow.'
                      : selectedDateFilter === 'COMPLETED'
                      ? 'No completed consultations found.'
                      : 'No upcoming appointments booked for selected period.'}
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-black text-slate-900 text-base">
                      #{String(apt.tokenNumber).padStart(2, '0')}
                    </td>
                    {selectedDateFilter !== 'TODAY' && (
                      <td className="px-5 py-4 font-bold text-royal-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-royal-500" />
                          <span>{apt.appointmentDate}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{apt.patient.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        +91 {apt.patient.mobileNumber} • {apt.patient.bloodGroup ? `Blood: ${apt.patient.bloodGroup}` : 'Blood: Not specified'}
                      </div>
                      {apt.assignedStaff ? (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-teal-800 font-semibold bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                          <Check className="w-3 h-3 text-teal-600" />
                          Nurse: {apt.assignedStaff.user?.name || 'Assigned Staff'}
                        </div>
                      ) : profile?.assignedStaff ? (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-teal-800 font-semibold bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                          <Check className="w-3 h-3 text-teal-600" />
                          Nurse: {profile.assignedStaff.user?.name}
                        </div>
                      ) : (
                        <div className="mt-1 inline-block text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          Nurse: General Pool
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{apt.timeSlot}</td>
                    <td className="px-5 py-4 font-mono font-bold text-royal-800">
                      {apt.digitalOp?.opNumber || 'N/A'}
                    </td>
                    <td className="px-5 py-4">
                      {apt.status === 'CONFIRMED' && <Badge variant="info">NOT STARTED</Badge>}
                      {apt.status === 'WAITING' && <Badge variant="warning">WAITING IN OPD</Badge>}
                      {apt.status === 'DRAFT' && (
                        <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
                          DRAFT
                        </Badge>
                      )}
                      {apt.status === 'IN_CONSULTATION' && (
                        <Badge variant="purple" className="bg-pink-100 text-pink-700 border-pink-200">IN CONSULTATION</Badge>
                      )}
                      {apt.status === 'COMPLETED' && <Badge variant="success">COMPLETED</Badge>}
                      {apt.status === 'CANCELLED' && <Badge variant="danger">CANCELLED</Badge>}
                    </td>
                    <td className="px-5 py-4">
                      {apt.prescription?.followUpDate ? (
                        <span className="inline-flex items-center gap-1 font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded text-xs whitespace-nowrap">
                          <Calendar className="w-3 h-3 text-teal-600" />
                          {apt.prescription.followUpDate}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {apt.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs"
                          onClick={() => handleOpenConsultModal(apt)}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" /> Resume Consultation
                        </Button>
                      )}

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
                        selectedDateFilter === 'TODAY' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-royal-700 bg-royal-50 border-royal-200 hover:bg-royal-100 font-bold"
                            onClick={() => startMutation.mutate(apt.id)}
                          >
                            <Play className="w-3.5 h-3.5 mr-1" /> Call Patient
                          </Button>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                              Scheduled
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-royal-700 hover:bg-royal-50 font-bold"
                              onClick={() => handleOpenConsultModal(apt)}
                              title="Pre-consultation Workspace"
                            >
                              <FileText className="w-3 h-3 mr-1" /> View Details
                            </Button>
                          </div>
                        )
                      )}

                      {apt.status === 'COMPLETED' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenConsultModal(apt)}
                            className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold"
                            title="View / Edit Clinical Consultation and Save Changes"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" /> View / Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintConsultationPdf(apt.id)}
                            className="text-xs border-royal-200 text-royal-700 hover:bg-royal-50 font-bold"
                            title="Print on Hospital Letterhead Paper"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" /> Print Rx
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadConsultationPdf(apt.id, apt.patient.fullName)}
                            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                            title="Download Clinical Consultation PDF"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" /> PDF
                          </Button>
                        </div>
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
        <div className="space-y-6">
          {/* Profile Photo & Identity Card (Requirement 20) */}
          <Card className="rounded-2xl border-slate-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-royal-50 border-2 border-royal-200 flex items-center justify-center text-royal-700 shadow-inner">
                  {(user?.avatarUrl || profile?.user?.avatarUrl || profile?.avatarUrl) ? (
                    <img
                      src={getMediaUrl(user?.avatarUrl || profile?.user?.avatarUrl || profile?.avatarUrl)}
                      alt="Doctor Profile"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80';
                      }}
                    />
                  ) : (
                    <User className="w-12 h-12 text-royal-400" />
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                      <InlineSpinner size="md" className="text-royal-600" />
                    </div>
                  )}
                </div>

                <label
                  htmlFor="doctor-avatar-file-input"
                  className="absolute -bottom-2 -right-2 p-2 bg-royal-600 hover:bg-royal-700 text-white rounded-xl shadow-md cursor-pointer transition-all hover:scale-105"
                  title="Upload Doctor Photo"
                >
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    id="doctor-avatar-file-input"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleProfilePhotoUpload(files[0]);
                      }
                    }}
                    disabled={isUploadingPhoto}
                  />
                </label>
              </div>

              <div className="space-y-1 text-center sm:text-left flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    Dr. {profile?.name || user?.name || 'Doctor'}
                  </h3>
                  <Badge variant="purple" className="text-xs">
                    {profile?.specialization || 'Consultant Specialist'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {profile?.hospital?.name || user?.hospital?.name || 'Rocket Wheel MedPulse Healthcare'} • Reg No: {profile?.registrationNumber || 'DOC-REG-NMC'}
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <label
                    htmlFor="doctor-avatar-file-input"
                    className="text-xs font-semibold text-royal-700 hover:text-royal-800 cursor-pointer underline"
                  >
                    Change photo
                  </label>
                  {(user?.avatarUrl || profile?.user?.avatarUrl || profile?.avatarUrl) && (
                    <>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleProfilePhotoRemove}
                        disabled={isUploadingPhoto}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                      >
                        Remove photo
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Designated Support Staff / Triage Nurse Configuration Card */}
          <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-teal-600" />
                  Designated Support Staff (Triage & Pre-Screening)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Designate a registered hospital nurse or support staff to exclusively record vital signs for all your OPD patient tokens
                </p>
              </div>
              {profile?.assignedStaff ? (
                <Badge variant="success" className="text-xs font-bold">
                  Assigned: {profile.assignedStaff.user?.name}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs font-semibold text-slate-500">
                  Hospital General Pool
                </Badge>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 max-w-xl">
              <div className="flex-1">
                <label className="block font-semibold text-slate-700 text-xs mb-1.5">
                  Select Registered Hospital Support Staff
                </label>
                <select
                  value={profile?.assignedStaffId || ''}
                  onChange={(e) => handleAssignStaff(e.target.value)}
                  disabled={assignSupportStaffMutation.isPending || isLoadingSupportStaff}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white text-slate-800 focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="">General Hospital Pool (Any available nurse)</option>
                  {(hospitalSupportStaff || []).map((staff: any) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.user?.name || 'Staff Member'} — {staff.roleTitle || 'Nurse'} {staff.department?.name ? `(${staff.department.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {profile?.assignedStaffId && (
                <div className="sm:self-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignStaff('')}
                    disabled={assignSupportStaffMutation.isPending}
                    className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 hover:border-rose-400 hover:text-rose-800 shadow-sm flex items-center gap-1.5"
                    title="Remove assignment and return to general nursing pool"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Reset to Pool
                  </Button>
                </div>
              )}
            </div>

            {profile?.assignedStaff && (
              <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl text-xs text-teal-900 flex flex-wrap items-center gap-4">
                <span className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  Active Nurse: {profile.assignedStaff.user?.name}
                </span>
                <span>•</span>
                <span>Role: {profile.assignedStaff.roleTitle || 'Triage / Screening Nurse'}</span>
                {profile.assignedStaff.user?.phone && (
                  <>
                    <span>•</span>
                    <span>Contact: +91 {profile.assignedStaff.user.phone}</span>
                  </>
                )}
                {profile.assignedStaff.user?.email && (
                  <>
                    <span>•</span>
                    <span>Email: {profile.assignedStaff.user.email}</span>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* OPD Consultation Hours & Settings Card */}
          <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">OPD Consultation Hours & Slot Duration</h2>
              <p className="text-xs text-slate-500">
                Configure your consultation slot duration, daily clinic timing, working days, and consultation fee
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
                const slotDuration = (form.elements.namedItem('slotDuration') as HTMLSelectElement).value;
                const about = (form.elements.namedItem('about') as HTMLTextAreaElement).value;
                const languages = (form.elements.namedItem('languages') as HTMLInputElement).value;

                updateRosterMutation.mutate({
                  consultationFee: Number(fee),
                  workingDays: days,
                  workingHoursStart: start,
                  workingHoursEnd: end,
                  slotDurationMinutes: Number(slotDuration),
                  about,
                  languages,
                });
              }}
              className="space-y-4 text-xs max-w-2xl"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Consultation Fee (₹) <span className="text-rose-500">*</span>
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
                    Working Days (Comma-separated) <span className="text-rose-500">*</span>
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

              {/* Slot Duration Selector (Requirement 7) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    OPD Slot Duration per Patient <span className="text-royal-600 font-bold">*</span>
                  </label>
                  <select
                    name="slotDuration"
                    defaultValue={profile?.slotDurationMinutes || 15}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white text-slate-800"
                  >
                    <option value={5}>5 minutes (Fast triage / follow-up)</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes (Standard OPD)</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes (Comprehensive consult)</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes (Specialized consultation)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Patient appointment slots will be generated at this interval
                  </p>
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
                  className="bg-royal-600 hover:bg-royal-700 text-white font-bold"
                  disabled={updateRosterMutation.isPending}
                >
                  {updateRosterMutation.isPending ? 'Updating...' : 'Save Consultation Settings'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
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
                          className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 shadow-xs"
                          onClick={() => {
                            if (window.confirm('Cancel this leave request?')) {
                              cancelLeaveMutation.mutate(leave.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" /> Cancel Leave
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

      {/* TAB: REUSABLE DISEASE-BASED PRESCRIPTION & LAB TEMPLATES */}
      {activeTab === 'templates' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
          {/* Sub-tab switcher: Prescription (Rx) vs Lab Test (Diagnostics) */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setTemplateSubTab('rx')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                templateSubTab === 'rx'
                  ? 'bg-white text-royal-700 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4 text-royal-600" />
              Prescription Templates (Rx)
              <Badge variant="outline" className="ml-1 text-[10px] bg-slate-50">
                {(templates || []).length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setTemplateSubTab('lab')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                templateSubTab === 'lab'
                  ? 'bg-white text-purple-700 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FlaskConical className="w-4 h-4 text-purple-600" />
              Diagnostic Lab Test Templates
              <Badge variant="outline" className="ml-1 text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                {(labTemplates || []).length}
              </Badge>
            </button>
          </div>

          {/* PRESCRIPTION TEMPLATES SUB-TAB */}
          {templateSubTab === 'rx' && (
            <div className="space-y-6">
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
                            className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 shadow-xs"
                            onClick={() => deleteTemplateMutation.mutate(tmpl.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" /> Delete
                          </Button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* DIAGNOSTIC LAB TEST TEMPLATES SUB-TAB */}
          {templateSubTab === 'lab' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-purple-600" />
                    Disease-Based Diagnostic Lab Test Template Library
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Saved diagnostic investigation packages for diseases (e.g. Dengue Fever, Diabetic Workup, Thyroid Screening) for rapid clinical requisition
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setNewLabTemplateDisease('');
                      setNewLabTemplateDescription('');
                      setNewLabTemplateTests([{ name: '', code: '', category: 'Pathology', price: 0, notes: '' }]);
                      setIsSaveLabTemplateOpen(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 font-bold text-white shadow-sm"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Create New Lab Template
                  </Button>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search lab templates by disease name, test name, or description..."
                  value={labTemplateSearch}
                  onChange={(e) => setLabTemplateSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const filtered = (labTemplates || []).filter((tmpl: any) => {
                    if (!labTemplateSearch.trim()) return true;
                    const q = labTemplateSearch.toLowerCase();
                    const diseaseMatch = tmpl.diseaseName?.toLowerCase().includes(q);
                    const descMatch = tmpl.description?.toLowerCase().includes(q);
                    const tests = tmpl.labTestsList || (typeof tmpl.labTests === 'string' ? JSON.parse(tmpl.labTests || '[]') : tmpl.labTests) || [];
                    const testMatch = (tests || []).some((t: any) =>
                      t.name?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)
                    );
                    return diseaseMatch || descMatch || testMatch;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        {labTemplateSearch
                          ? 'No lab test templates match your search.'
                          : 'No lab test templates created yet. Click \'Create New Lab Template\' or save templates from the consultation requisition modal.'}
                      </div>
                    );
                  }

                  return filtered.map((tmpl: any) => {
                    const tests = tmpl.labTestsList || (typeof tmpl.labTests === 'string' ? JSON.parse(tmpl.labTests || '[]') : tmpl.labTests) || [];
                    const totalCost = (tests || []).reduce((sum: number, t: any) => sum + (Number(t.price) || 0), 0);
                    return (
                      <div
                        key={tmpl.id}
                        className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-3 hover:border-purple-200 transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-slate-900 text-sm">{tmpl.diseaseName}</h3>
                            <Badge variant="purple" className="text-[10px] shrink-0 bg-purple-100 text-purple-700 border-purple-200">
                              {tests.length} Test{tests.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {tmpl.description && (
                            <p className="text-[11px] text-slate-500 italic bg-purple-50/50 p-2 rounded-lg border border-purple-100/60">
                              {tmpl.description}
                            </p>
                          )}
                          <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-40 overflow-y-auto">
                            {tests.map((t: any, idx: number) => (
                              <div key={idx} className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-700 flex items-center justify-between">
                                <div className="min-w-0 pr-2">
                                  <span className="font-bold text-slate-900 block truncate">{t.name}</span>
                                  <div className="text-slate-400 text-[10px]">
                                    {t.category || 'Pathology'} {t.notes ? `• ${t.notes}` : ''}
                                  </div>
                                </div>
                                {Number(t.price) > 0 && (
                                  <span className="font-bold text-purple-700 text-[11px] shrink-0">
                                    ₹{t.price}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          {totalCost > 0 && (
                            <div className="flex items-center justify-between pt-1 text-[11px] font-semibold text-slate-500 border-t border-slate-100">
                              <span>Est. Package Total:</span>
                              <span className="text-purple-900 font-black">₹{totalCost}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-600 hover:bg-purple-50 text-xs"
                            onClick={() => {
                              setEditingLabTemplate({
                                id: tmpl.id,
                                diseaseName: tmpl.diseaseName,
                                description: tmpl.description || '',
                                labTests: tests.map((t: any) => ({
                                  name: t.name || '',
                                  code: t.code || '',
                                  category: t.category || 'Pathology',
                                  price: t.price || 0,
                                  notes: t.notes || '',
                                })),
                              });
                            }}
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 shadow-xs"
                            onClick={() => {
                              if (window.confirm(`Delete lab test template for "${tmpl.diseaseName}"?`)) {
                                deleteLabTemplateMutation.mutate(tmpl.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" /> Delete
                          </Button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-semibold">Filter Date:</span>
                <input
                  type="date"
                  value={doctorLabDateFilter}
                  onChange={(e) => setDoctorLabDateFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-medium"
                />
                {doctorLabDateFilter ? (
                  <button
                    type="button"
                    onClick={() => setDoctorLabDateFilter('')}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded"
                  >
                    Clear
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDoctorLabDateFilter(new Date().toISOString().split('T')[0])}
                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded"
                  >
                    Today
                  </button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchLabRequests()} className="text-xs">
                Refresh Tests
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Requisition #</th>
                  <th className="px-5 py-3">Requested Date</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Tests Ordered</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Diagnostic Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(labRequests || []).filter((req: any) => {
                  if (!doctorLabDateFilter) return true;
                  const d = req.createdAt ? req.createdAt.slice(0, 10) : req.preferredDate;
                  return d === doctorLabDateFilter;
                }).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      No diagnostic lab requisitions found for the selected period.
                    </td>
                  </tr>
                ) : (
                  (labRequests || [])
                    .filter((req: any) => {
                      if (!doctorLabDateFilter) return true;
                      const d = req.createdAt ? req.createdAt.slice(0, 10) : req.preferredDate;
                      return d === doctorLabDateFilter;
                    })
                    .map((req: any) => {
                      const parsedTests = typeof req.tests === 'string' ? JSON.parse(req.tests) : req.tests;
                      const reqDate = req.createdAt ? new Date(req.createdAt).toLocaleDateString() : (req.preferredDate || '—');
                      const reqTime = req.createdAt ? new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      return (
                        <tr key={req.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-mono font-bold text-purple-700">
                            {req.requestNumber}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{reqDate}</div>
                            {reqTime && <div className="text-[10px] text-slate-400">{reqTime}</div>}
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
                                  href={getMediaUrl(req.report.fileUrl)}
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

      {/* TAB: DOCTOR EDIT PROFILE */}
      {activeTab === 'profile' && (
        <DoctorEditProfileSection
          profile={profile}
          user={user}
          refetchProfile={refetchProfile}
          updateUser={updateUser}
        />
      )}

      {/* TAB: DOCTOR LETTERHEAD & BRANDING */}
      {activeTab === 'branding' && (
        <DoctorLetterheadBrandingSection
          user={user}
          profile={profile}
          refetchProfile={refetchProfile}
        />
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
          onClose={handleRequestCloseConsultModal}
          title={`Clinical Consultation - ${activeAppointment.patient.fullName} (Token #${activeAppointment.tokenNumber})`}
          maxWidth="2xl"
        >
          {isConsultDetailsLoading || (consultDetails && consultDetails.appointment?.id !== activeAppointment.id) ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <InlineSpinner size="lg" />
              <p className="text-xs font-semibold text-slate-500">
                Loading clinical consultation encounter for {activeAppointment.patient.fullName}...
              </p>
            </div>
          ) : (
            <div className="space-y-5 text-xs">
            {/* Patient Demographics & MRN Banner */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">
                    {activeAppointment.patient.fullName}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    MRN: <strong className="text-royal-700">{consultDetails?.patient?.patientIdNumber || activeAppointment.patient.id.slice(0, 8).toUpperCase()}</strong>
                  </span>
                  {activeAppointment.status === 'COMPLETED' ? (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                      Completed Consult
                    </span>
                  ) : activeAppointment.status === 'DRAFT' ? (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                      Draft Saved
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-slate-600 font-medium text-[11px] mt-1">
                  <span>Age: {consultDetails?.patient?.age || '--'}</span>
                  <span>•</span>
                  <span>Gender: {consultDetails?.patient?.gender || '--'}</span>
                  <span>•</span>
                  <span className="font-bold text-rose-600">Blood: {consultDetails?.patient?.bloodGroup || 'Not specified'}</span>
                  <span>•</span>
                  <span>Mobile: +91 {activeAppointment.patient.mobileNumber}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {saveDraftMutation.isPending || saveStatus === 'saving' ? (
                  <span className="flex items-center gap-1.5 text-royal-700 font-semibold text-[11px] bg-royal-50 border border-royal-200 px-2.5 py-1 rounded-lg shadow-2xs">
                    <InlineSpinner size="sm" />
                    <span>Saving...</span>
                  </span>
                ) : saveStatus === 'error' ? (
                  <span className="flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px] shadow-2xs">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Save failed</span>
                  </span>
                ) : saveStatus === 'unsaved' ? (
                  <span className="flex items-center gap-1.5 text-amber-800 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-[11px]" title="Auto-save will trigger 30 seconds after you stop typing">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>Unsaved changes</span>
                  </span>
                ) : lastSavedTime ? (
                  <span className="flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Saved at {lastSavedTime}</span>
                  </span>
                ) : null}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveChanges}
                  isLoading={saveDraftMutation.isPending}
                  className="border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 font-bold flex items-center gap-1 text-xs shadow-2xs"
                  title="Save clinical consultation changes (Ctrl+S / Cmd+S)"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-600" /> Save Changes
                </Button>
              </div>
            </div>

            {/* Support Staff Recorded Vitals Banner (Requirement 10) */}
            {(consultDetails?.vitals || consultDetails?.currentVitals) ? (
              (() => {
                const rv = consultDetails?.vitals || consultDetails?.currentVitals;
                const nurseName = rv.recordedByStaff?.name || rv.recordedBy?.name;
                const recordedTime = rv.createdAt ? new Date(rv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div className="p-3 bg-teal-50/90 border border-teal-200 rounded-xl space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-teal-900 flex items-center gap-1.5 text-xs">
                        <Activity className="w-4 h-4 text-teal-600 animate-pulse" />
                        Clinical Vitals Recorded by Nursing / Support Staff
                      </span>
                      <span className="text-[10px] text-teal-800 font-bold bg-teal-100 border border-teal-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-teal-600" />
                        Pre-Screened {nurseName ? `by ${nurseName}` : ''} {recordedTime ? `at ${recordedTime}` : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1 font-mono text-xs text-slate-800">
                      <div>BP: <strong className="font-bold text-slate-900">{formatBP(rv.bloodPressure) || formatSystolicDiastolicBP(rv.bloodPressureSys || rv.bpSystolic, rv.bloodPressureDia || rv.bpDiastolic) || (rv.bloodPressureSys ? formatBP(rv.bloodPressureSys) : 'N/A')}</strong></div>
                      <div>Pulse: <strong className="font-bold text-slate-900">{formatPulse(rv.pulseRate || rv.pulse) || 'N/A'}</strong></div>
                      <div>Temp: <strong className="font-bold text-slate-900">{formatTemperature(rv.temperature) || 'N/A'}</strong></div>
                      <div>SpO2: <strong className="font-bold text-slate-900">{formatSpO2(rv.spO2 || rv.spo2) || 'N/A'}</strong></div>
                      <div>Weight: <strong className="font-bold text-slate-900">{formatWeight(rv.weightKg || rv.weight) || 'N/A'}</strong></div>
                      <div>Height: <strong className="font-bold text-slate-900">{formatHeight(rv.heightCm || rv.height) || 'N/A'}</strong></div>
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
                <span>No vitals recorded yet. You may enter vitals manually below.</span>
              </div>
            )}

            {/* Consultation Vitals Section with Dedicated Save & Edit */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200/80 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-royal-600" />
                    Consultation Vitals (Doctor Verified)
                  </span>
                  {isVitalsModified && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      Unsaved changes
                    </span>
                  )}
                  {vitalsLastSavedTime && !isVitalsModified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Saved at {vitalsLastSavedTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {!isVitalsEditing ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsVitalsEditing(true)}
                      className="text-xs text-royal-700 border-royal-300 hover:bg-royal-50 font-semibold flex items-center gap-1 py-1 px-2.5 h-auto shadow-2xs"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit Vitals
                    </Button>
                  ) : (
                    <>
                      {hasSavedVitals && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelVitals}
                          disabled={isSavingVitals}
                          className="text-xs text-slate-600 hover:text-slate-800 py-1 px-2 h-auto"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveVitals}
                        isLoading={isSavingVitals}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 h-auto flex items-center gap-1 shadow-2xs"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Vitals
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {!isVitalsEditing ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Blood Pressure</span>
                    <strong className="text-xs font-bold text-slate-900 block truncate">
                      {vitals.bp || <span className="text-slate-400 font-normal italic">—</span>}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pulse Rate</span>
                    <strong className="text-xs font-bold text-slate-900 block truncate">
                      {vitals.pulse || <span className="text-slate-400 font-normal italic">—</span>}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Temperature</span>
                    <strong className="text-xs font-bold text-slate-900 block truncate">
                      {vitals.temperature || <span className="text-slate-400 font-normal italic">—</span>}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Weight</span>
                    <strong className="text-xs font-bold text-slate-900 block truncate">
                      {vitals.weight || <span className="text-slate-400 font-normal italic">—</span>}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">SpO2</span>
                    <strong className="text-xs font-bold text-slate-900 block truncate">
                      {vitals.spo2 || <span className="text-slate-400 font-normal italic">—</span>}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-medium mb-0.5">Blood Pressure</span>
                    <input
                      type="text"
                      value={vitals.bp}
                      onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                      placeholder="e.g. 120/80 mmHg"
                      className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-royal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-medium mb-0.5">Pulse Rate</span>
                    <input
                      type="text"
                      value={vitals.pulse}
                      onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                      placeholder="e.g. 76 bpm"
                      className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-royal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-medium mb-0.5">Temperature</span>
                    <input
                      type="text"
                      value={vitals.temperature}
                      onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                      placeholder="e.g. 98.4 F"
                      className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-royal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-medium mb-0.5">Weight</span>
                    <input
                      type="text"
                      value={vitals.weight}
                      onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                      placeholder="e.g. 65 kg"
                      className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-royal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-medium mb-0.5">SpO2</span>
                    <input
                      type="text"
                      value={vitals.spo2}
                      onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                      placeholder="e.g. 99%"
                      className="w-full text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-royal-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Chief Complaints Section with Dedicated Save & Edit */}
            <div className="space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="font-bold text-slate-800 text-xs">
                    Chief Complaints <span className="text-slate-400 font-normal text-[11px]">(Primary symptoms, duration, presenting illness)</span>
                  </label>
                  {isComplaintsModified && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      Unsaved changes
                    </span>
                  )}
                  {complaintsLastSavedTime && !isComplaintsModified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Saved at {complaintsLastSavedTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {!isComplaintsEditing ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsComplaintsEditing(true)}
                      className="text-xs text-royal-700 border-royal-300 hover:bg-royal-50 font-semibold flex items-center gap-1 py-1 px-2.5 h-auto shadow-2xs"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit Complaints
                    </Button>
                  ) : (
                    <>
                      {hasSavedComplaints && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelComplaints}
                          disabled={isSavingComplaints}
                          className="text-xs text-slate-600 hover:text-slate-800 py-1 px-2 h-auto"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveComplaints}
                        isLoading={isSavingComplaints}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 h-auto flex items-center gap-1 shadow-2xs"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Complaints
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {!isComplaintsEditing ? (
                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap font-medium min-h-[50px]">
                  {chiefComplaints || <span className="text-slate-400 italic">No chief complaints entered. Click Edit Complaints to enter details.</span>}
                </div>
              ) : (
                <textarea
                  rows={2}
                  value={chiefComplaints}
                  onChange={(e) => setChiefComplaints(e.target.value)}
                  placeholder="e.g. High fever with chills for 3 days, severe sore throat, dry cough..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-royal-500 focus:outline-none font-medium"
                />
              )}
            </div>

            {/* Examination Section with Dedicated Save & Edit */}
            <div className="space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="font-bold text-slate-800 text-xs">
                    Examination <span className="text-slate-400 font-normal text-[11px]">(Physical & clinical examination findings, systemic examination)</span>
                  </label>
                  {isExaminationModified && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      Unsaved changes
                    </span>
                  )}
                  {examinationLastSavedTime && !isExaminationModified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Saved at {examinationLastSavedTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {!isExaminationEditing ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExaminationEditing(true)}
                      className="text-xs text-royal-700 border-royal-300 hover:bg-royal-50 font-semibold flex items-center gap-1 py-1 px-2.5 h-auto shadow-2xs"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit Examination
                    </Button>
                  ) : (
                    <>
                      {hasSavedExamination && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelExamination}
                          disabled={isSavingExamination}
                          className="text-xs text-slate-600 hover:text-slate-800 py-1 px-2 h-auto"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveExamination}
                        isLoading={isSavingExamination}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 h-auto flex items-center gap-1 shadow-2xs"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Examination
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {!isExaminationEditing ? (
                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap font-medium min-h-[60px]">
                  {examination || <span className="text-slate-400 italic">No examination findings recorded. Click Edit Examination to enter details.</span>}
                </div>
              ) : (
                <textarea
                  rows={3}
                  value={examination}
                  onChange={(e) => setExamination(e.target.value)}
                  placeholder="e.g. Chest: Clear bilaterally, CVS: S1 S2 heard no murmurs, P/A: Soft non-tender, Throat: Congested with mild tonsillar erythema..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-royal-500 focus:outline-none font-medium resize-y"
                />
              )}
            </div>

            {/* Requested Diagnostic Laboratory Tests (Requirement 14 & Lab Templates) */}
            {consultDetails?.appointment?.labRequests && consultDetails.appointment.labRequests.length > 0 && (
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950 flex items-center gap-1.5 text-xs">
                    <FlaskConical className="w-4 h-4 text-purple-600" />
                    Requested Diagnostic Laboratory Tests
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const testsToSave: any[] = [];
                        (consultDetails?.appointment?.labRequests || []).forEach((req: any) => {
                          const list = req.testsList || (typeof req.tests === 'string' ? JSON.parse(req.tests) : req.tests) || [];
                          if (Array.isArray(list)) {
                            list.forEach((t: any) => {
                              testsToSave.push({
                                name: t.name || '',
                                code: t.code || '',
                                category: t.category || 'Pathology',
                                price: Number(t.price || 0),
                                notes: t.notes || '',
                              });
                            });
                          }
                        });
                        setNewLabTemplateDisease(diagnosis || '');
                        setNewLabTemplateDescription('');
                        setNewLabTemplateTests(
                          testsToSave.length > 0
                            ? testsToSave
                            : [{ name: '', code: '', category: 'Pathology', price: 0, notes: '' }]
                        );
                        setIsSaveLabTemplateOpen(true);
                      }}
                      className="text-[11px] border-purple-300 text-purple-700 hover:bg-purple-100 py-0.5 px-2 h-auto"
                      title="Save these requested tests as a reusable template for this disease"
                    >
                      <Bookmark className="w-3 h-3 mr-1" /> Save Tests as Template
                    </Button>
                    <Badge variant="purple" className="text-[10px]">
                      {consultDetails.appointment.labRequests.length} Request{consultDetails.appointment.labRequests.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {consultDetails.appointment.labRequests.map((req: any) => {
                    const isCompleted = req.status === 'COMPLETED';
                    const testNames =
                      (req.testsList || []).map((t: any) => t.name).join(', ') ||
                      (req.tests ? (typeof req.tests === 'string' ? JSON.parse(req.tests).map((t: any) => t.name).join(', ') : req.tests) : 'Diagnostic Tests');

                    return (
                      <div
                        key={req.id}
                        className="p-2 bg-white rounded-lg border border-purple-100 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ✓ Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3 text-amber-600" /> ○ Pending
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">{testNames}</span>
                          <span className="text-[10px] text-slate-400">({req.lab?.name || 'Hospital Lab'})</span>
                        </div>

                        {req.report?.fileUrl && (
                          <a
                            href={getMediaUrl(req.report.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-600 hover:text-purple-800 font-bold underline inline-flex items-center gap-1 text-[11px]"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Report
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Disease Template Selector Bars (Rx and Diagnostics) */}
            <div className="space-y-2">
              {/* Rx Template Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-royal-50/70 rounded-xl border border-royal-200/80">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <BookOpen className="w-4 h-4 text-royal-600 shrink-0" />
                  <span className="font-bold text-royal-900 text-xs shrink-0">Apply Rx Template:</span>
                  <select
                    onChange={(e) => {
                      const t = templates?.find((tmpl: any) => tmpl.id === e.target.value);
                      if (t) {
                        if (t.diagnosis) setDiagnosis(t.diagnosis);
                        const parsedMeds = typeof t.medicines === 'string' ? JSON.parse(t.medicines) : t.medicines;
                        if (Array.isArray(parsedMeds) && parsedMeds.length > 0) {
                          const templateMeds: MedicineItem[] = parsedMeds.map((m: any, idx: number) => ({
                            _id: `med_tmpl_${idx}_${Date.now()}`,
                            name: m.name || '',
                            dosage: m.dosage || '1 tablet',
                            frequency: m.frequency || 'TDS (Thrice daily)',
                            duration: m.duration || '5 days',
                            instructions: m.instructions || 'After food',
                            priority: typeof m.priority === 'number' && m.priority > 0 ? m.priority : idx + 1,
                          }));
                          setMedicines(sortMedicinesByPriority(templateMeds));
                        }
                        if (t.instructions) setClinicalNotes(t.instructions);
                        toast.success('Template Loaded', `Applied preset prescription for ${t.diseaseName}`);
                      }
                    }}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-royal-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-royal-500"
                  >
                    <option value="">Choose disease prescription template (e.g. Viral Fever, Gastroenteritis)...</option>
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
                    <Bookmark className="w-3.5 h-3.5 mr-1" /> Save Rx Template
                  </Button>
                </div>
              </div>

              {/* Lab Test Template Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-purple-50/70 rounded-xl border border-purple-200/80">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FlaskConical className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="font-bold text-purple-900 text-xs shrink-0">Apply Lab Template:</span>
                  <select
                    onChange={(e) => {
                      const tmpl = labTemplates?.find((t: any) => t.id === e.target.value);
                      if (tmpl) {
                        const tests = tmpl.labTestsList || (typeof tmpl.labTests === 'string' ? JSON.parse(tmpl.labTests || '[]') : tmpl.labTests) || [];
                        if (Array.isArray(tests) && tests.length > 0) {
                          const formatted = tests.map((t: any) => ({
                            name: t.name,
                            code: t.code || undefined,
                            price: Number(t.price || 0),
                            tatHours: 24,
                            category: t.category || 'Pathology',
                          }));
                          setSelectedCatalogTests(formatted);
                          if (tmpl.description) setLabNotes(tmpl.description);
                          setIsLabModalOpen(true);
                          toast.success('Lab Template Loaded', `Opened lab requisition with ${tests.length} test(s) for ${tmpl.diseaseName}`);
                        }
                      }
                    }}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">Choose disease lab template (e.g. Dengue Fever, Diabetic Workup)...</option>
                    {(labTemplates || []).map((tmpl: any) => {
                      const testsCount = (tmpl.labTestsList || (typeof tmpl.labTests === 'string' ? JSON.parse(tmpl.labTests || '[]') : tmpl.labTests) || []).length;
                      return (
                        <option key={tmpl.id} value={tmpl.id}>
                          {tmpl.diseaseName} ({testsCount} tests)
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
                      setNewLabTemplateDisease(diagnosis || '');
                      setNewLabTemplateDescription('');
                      setNewLabTemplateTests([{ name: '', code: '', category: 'Pathology', price: 0, notes: '' }]);
                      setIsSaveLabTemplateOpen(true);
                    }}
                    className="text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                  >
                    <Bookmark className="w-3.5 h-3.5 mr-1" /> New Lab Template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLabModalOpen(true)}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold border-purple-600 shadow-2xs"
                  >
                    <FlaskConical className="w-3.5 h-3.5 mr-1" /> Request Lab Test
                  </Button>
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
                placeholder="e.g. Acute Bronchitis / Essential Hypertension / Viral Pharyngitis"
                className="w-full text-sm font-semibold p-2.5 rounded-xl border border-slate-200 focus:ring-royal-500"
                required
              />
            </div>

            {/* Prescription Medicines Builder */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                    <Pill className="w-4 h-4 text-pink-500" />
                    Prescribed Medicines
                  </label>
                  <span className="text-[11px] text-royal-700 bg-royal-50 font-semibold px-2 py-0.5 rounded-full border border-royal-200">
                    Auto-sorted by Priority
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addMedicine}
                  className="text-xs border-dashed border-slate-300 hover:border-royal-400 hover:bg-royal-50/50"
                  title="Add an empty medicine row for custom entry"
                >
                  <Plus className="w-3.5 h-3.5 mr-1 text-royal-600" /> Add Custom Medicine
                </Button>
              </div>

              {/* DEDICATED MEDICINE SEARCH BAR */}
              <div ref={searchContainerRef} className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={medicineSearchQuery}
                    onChange={(e) => {
                      setMedicineSearchQuery(e.target.value);
                      setIsSearchDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (medicineSearchQuery.trim()) {
                        setIsSearchDropdownOpen(true);
                      }
                    }}
                    placeholder="Search medicine by name (e.g. Paracetamol, Amoxicillin, Pantoprazole, Azithromycin)..."
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-royal-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-500 focus:border-royal-500 shadow-2xs"
                  />
                  {isSearchingMedicines ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <InlineSpinner className="w-4 h-4 text-royal-600" />
                    </div>
                  ) : medicineSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMedicineSearchQuery('');
                        setIsSearchDropdownOpen(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>

                {/* SEARCH RESULTS DROPDOWN */}
                {isSearchDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1.5 max-h-72 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl divide-y divide-slate-100">
                    {medicineSearchResults.length > 0 ? (
                      <div>
                        <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                          <span>Matching Medicines ({medicineSearchResults.length})</span>
                          <span className="text-[10px] text-slate-400">Click to add to prescription</span>
                        </div>
                        {medicineSearchResults.map((item) => {
                          const isAlreadyAdded = medicines.some(
                            (m) => m.name.trim().toLowerCase() === item.name.trim().toLowerCase()
                          );
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelectMedicineFromSearch(item)}
                              className={`p-3 flex items-center justify-between gap-3 hover:bg-royal-50/60 cursor-pointer transition-colors ${
                                isAlreadyAdded ? 'bg-amber-50/40' : ''
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-xs">{item.name}</span>
                                  {item.dosageForm && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 font-medium rounded border border-blue-200">
                                      {item.dosageForm}
                                    </span>
                                  )}
                                  {item.strength && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-purple-50 text-purple-700 font-medium rounded border border-purple-200">
                                      {item.strength}
                                    </span>
                                  )}
                                  {item.category && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                                  {item.genericName && <span>Gen: {item.genericName}</span>}
                                  <span>•</span>
                                  <span>Default: {item.defaultDosage || '1 Tab'} | {item.defaultFrequency || 'BD'} | {item.defaultDuration || '5 days'}</span>
                                  {item.defaultInstructions && (
                                    <>
                                      <span>•</span>
                                      <span className="italic">{item.defaultInstructions}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0">
                                {isAlreadyAdded ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-1 rounded-lg border border-amber-300">
                                    <Check className="w-3 h-3" /> Added
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    type="button"
                                    className="text-xs h-7 px-2.5 text-royal-700 border-royal-300 hover:bg-royal-600 hover:text-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectMedicineFromSearch(item);
                                    }}
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Add
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-500">
                        {isSearchingMedicines ? (
                          'Searching medicine catalogue...'
                        ) : (
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-700">No exact match found for "{medicineSearchQuery}"</p>
                            <p className="text-[11px] text-slate-400">
                              You can click <strong>"Add Custom Medicine"</strong> to enter this medication manually.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MEDICINE ITEMS LIST */}
              <div className="space-y-2.5">
                {medicines.map((med, idx) => {
                  const medKey = med._id || `med_${idx}`;
                  return (
                    <div
                      key={medKey}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 items-end hover:border-royal-300 transition-colors shadow-2xs"
                    >
                      {/* Priority Number Input */}
                      <div className="sm:col-span-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-bold text-royal-900 block">P#</span>
                          <span className="text-[9px] text-slate-400 font-mono">#{idx + 1}</span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={med.priority ?? idx + 1}
                          onChange={(e) => handleMedicinePriorityChange(medKey, e.target.value)}
                          onBlur={() => handleMedicinePriorityBlur(medKey)}
                          title="Numeric priority for sorting (1 = first, 2 = second, etc.)"
                          placeholder={`${idx + 1}`}
                          className="w-full text-xs font-bold text-center p-1.5 rounded-lg border border-royal-300 bg-white text-royal-900 focus:ring-1 focus:ring-royal-500 shadow-2xs"
                        />
                      </div>

                      {/* Medicine Name & Strength */}
                      <div className="sm:col-span-3">
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Medicine Name</span>
                        <input
                          type="text"
                          value={med.name}
                          onChange={(e) => updateMedicine(medKey, 'name', e.target.value)}
                          placeholder="e.g. Tab Amoxicillin 500mg"
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-900 focus:ring-1 focus:ring-royal-500"
                        />
                      </div>

                      {/* Dosage */}
                      <div className="sm:col-span-2">
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Dosage</span>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => updateMedicine(medKey, 'dosage', e.target.value)}
                          placeholder="e.g. 1 Tab / 5ml"
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-1 focus:ring-royal-500"
                        />
                      </div>

                      {/* Frequency */}
                      <div className="sm:col-span-2">
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Frequency</span>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => updateMedicine(medKey, 'frequency', e.target.value)}
                          placeholder="e.g. 1-0-1 / TDS / BD"
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-1 focus:ring-royal-500"
                        />
                      </div>

                      {/* Duration */}
                      <div className="sm:col-span-2">
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Duration</span>
                        <input
                          type="text"
                          value={med.duration}
                          onChange={(e) => updateMedicine(medKey, 'duration', e.target.value)}
                          placeholder="e.g. 5 days / 1 week"
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-1 focus:ring-royal-500"
                        />
                      </div>

                      {/* Instructions & Remove */}
                      <div className="sm:col-span-2 flex items-center gap-1.5">
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Instructions</span>
                          <input
                            type="text"
                            value={med.instructions}
                            onChange={(e) => updateMedicine(medKey, 'instructions', e.target.value)}
                            placeholder="e.g. After food"
                            className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-1 focus:ring-royal-500"
                          />
                        </div>
                        {medicines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMedicine(medKey)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                            title="Remove medicine from prescription"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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

            {/* Actions (Requirement 13 & 12) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrintConsultationPdf(activeAppointment.id)}
                  isLoading={isDownloadingPdf}
                  className="border-royal-300 text-royal-700 hover:bg-royal-50 font-bold"
                  title="Print on Hospital Letterhead Paper (with 2-inch top margin)"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Rx (Letterhead)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadConsultationPdf(activeAppointment.id, activeAppointment.patient.fullName)}
                  isLoading={isDownloadingPdf}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-bold"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download PDF
                </Button>
              </div>

              <div className="flex items-center gap-3">
                {/* Live Consultation Auto-Save / Save Changes Status Indicator */}
                <div className="text-xs">
                  {saveDraftMutation.isPending || saveStatus === 'saving' ? (
                    <span className="flex items-center gap-1.5 text-royal-700 font-semibold bg-royal-50 border border-royal-200 px-2.5 py-1 rounded-lg">
                      <InlineSpinner size="sm" />
                      <span>Saving...</span>
                    </span>
                  ) : saveStatus === 'error' ? (
                    <span className="flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Save failed</span>
                    </span>
                  ) : saveStatus === 'unsaved' ? (
                    <span className="flex items-center gap-1.5 text-amber-800 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-[11px]" title="Auto-save will trigger 30 seconds after you stop typing">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>Unsaved changes (auto-saving in 30s)</span>
                    </span>
                  ) : lastSavedTime ? (
                    <span className="flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Saved at {lastSavedTime}</span>
                    </span>
                  ) : null}
                </div>

                <Button variant="ghost" size="sm" onClick={handleRequestCloseConsultModal}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleSaveChanges}
                  isLoading={saveDraftMutation.isPending}
                  className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 font-bold flex items-center gap-1.5 shadow-2xs"
                  title="Save clinical consultation changes to database (Ctrl+S / Cmd+S)"
                >
                  <Save className="w-4 h-4 text-emerald-600" /> Save Changes
                </Button>
                <Button
                  size="md"
                  className="bg-royal-600 hover:bg-royal-700 font-bold text-white"
                  isLoading={completeMutation.isPending}
                  onClick={() => {
                    if (!diagnosis.trim()) {
                      toast.error('Diagnosis Required', 'Please enter a diagnosis');
                      return;
                    }

                    const validMedicines = sortMedicinesByPriority(
                      medicines
                        .filter((m) => m.name.trim())
                        .map((m, idx) => ({
                          name: m.name.trim(),
                          dosage: m.dosage.trim() || '1 tablet',
                          frequency: m.frequency.trim() || 'TDS (Thrice daily)',
                          duration: m.duration.trim() || '5 days',
                          instructions: m.instructions.trim() || 'After food',
                          priority: typeof m.priority === 'number' && m.priority > 0 ? m.priority : idx + 1,
                        }))
                    );

                    completeMutation.mutate({
                      appointmentId: activeAppointment.id,
                      payload: {
                        diagnosis: diagnosis.trim(),
                        chiefComplaints: chiefComplaints.trim() || undefined,
                        symptoms: chiefComplaints.trim() || symptoms.trim() || undefined,
                        examination: examination.trim() || undefined,
                        clinicalNotes: clinicalNotes.trim() || undefined,
                        followUpDate: followUpDate.trim() || undefined,
                        vitals,
                        medicines: validMedicines,
                        sendToPharmacy,
                      },
                    });
                  }}
                >
                  Complete & Issue Prescription
                </Button>
              </div>
            </div>
          </div>
          )}
        </Modal>
      )}

      {/* UNSAVED CHANGES CONFIRMATION MODAL */}
      {isUnsavedWarningOpen && (
        <Modal
          isOpen={isUnsavedWarningOpen}
          onClose={() => {
            setIsUnsavedWarningOpen(false);
            setPendingSwitchAppointment(null);
          }}
          title="Unsaved Consultation Changes"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-amber-950 mb-1">
                  {pendingSwitchAppointment
                    ? `Switching to ${pendingSwitchAppointment.patient.fullName}`
                    : 'You have unsaved changes'}
                </p>
                <p className="text-slate-600 leading-relaxed">
                  {pendingSwitchAppointment
                    ? `You have unsaved changes on ${activeAppointment?.patient.fullName || 'the current consultation'}. If you switch now without saving, those changes will be discarded.`
                    : 'You have made changes to this clinical consultation that have not been saved. If you close now, any changes made since your last save will be discarded.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsUnsavedWarningOpen(false);
                  setPendingSwitchAppointment(null);
                }}
                className="text-slate-600 font-bold"
              >
                Keep Editing
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleConfirmDiscard}
                className="border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold"
              >
                {pendingSwitchAppointment ? 'Discard & Switch' : 'Discard Changes'}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={pendingSwitchAppointment ? handleSaveAndSwitch : async () => {
                  setIsUnsavedWarningOpen(false);
                  await handleSaveChanges();
                }}
                className="bg-royal-600 hover:bg-royal-700 text-white font-bold"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {pendingSwitchAppointment ? 'Save Changes & Switch' : 'Save Changes Now'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* SAVE AS PRESCRIPTION TEMPLATE MODAL (Requirement 15: Simplified modal) */}
      {isSaveTemplateOpen && (
        <Modal
          isOpen={isSaveTemplateOpen}
          onClose={() => {
            setIsSaveTemplateOpen(false);
            setNewTemplateDisease('');
          }}
          title="New Disease Prescription Template"
          maxWidth="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTemplateDisease.trim()) {
                toast.error('Disease Name Required', 'Please enter a disease or condition name for this template.');
                return;
              }
              const currentMeds = medicines.filter((m) => m.name && m.name.trim());
              createTemplateMutation.mutate({
                diseaseName: newTemplateDisease.trim(),
                diagnosis: diagnosis.trim() || newTemplateDisease.trim(),
                medicines: currentMeds,
                instructions: clinicalNotes.trim() || undefined,
              });
            }}
            className="space-y-4 text-xs"
          >
            <p className="text-slate-500">
              Create a reusable disease template for your clinical practice. Medicines and clinical notes can be configured now or managed anytime later.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Disease / Condition Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newTemplateDisease}
                onChange={(e) => setNewTemplateDisease(e.target.value)}
                placeholder="e.g. Acute Gastroenteritis, Viral Fever, Type 2 DM, Hypertension"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-royal-500 focus:outline-none font-medium"
                required
                autoFocus
              />
            </div>

            {medicines.some((m) => m.name && m.name.trim()) && (
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-200">
                <span className="font-bold text-slate-700 block text-[11px]">
                  Attaching current workspace medicines ({medicines.filter((m) => m.name.trim()).length}):
                </span>
                {medicines.filter((m) => m.name && m.name.trim()).map((m, i) => (
                  <div key={i} className="text-slate-600 text-[11px]">
                    • {m.name} ({m.dosage || '1 tab'}, {m.frequency || 'OD'}, {m.duration || '5 days'})
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSaveTemplateOpen(false);
                  setNewTemplateDisease('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-royal-600 hover:bg-royal-700 text-white font-bold"
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
            {/* Disease Lab Template Quick Selector & Save Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-purple-50/80 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FlaskConical className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="font-bold text-purple-950 text-xs shrink-0">Apply Disease Template:</span>
                <select
                  onChange={(e) => {
                    const tmpl = labTemplates?.find((t: any) => t.id === e.target.value);
                    if (tmpl) {
                      const tests = tmpl.labTestsList || (typeof tmpl.labTests === 'string' ? JSON.parse(tmpl.labTests || '[]') : tmpl.labTests) || [];
                      if (Array.isArray(tests) && tests.length > 0) {
                        const formatted = tests.map((t: any) => ({
                          name: t.name,
                          code: t.code || undefined,
                          price: Number(t.price || 0),
                          tatHours: 24,
                          category: t.category || 'Pathology',
                        }));
                        setSelectedCatalogTests((prev) => {
                          const existingNames = new Set(prev.map((p) => p.name.toLowerCase()));
                          const additions = formatted.filter((f: any) => !existingNames.has(f.name.toLowerCase()));
                          return [...prev, ...additions];
                        });
                        if (tmpl.description && !labNotes) {
                          setLabNotes(tmpl.description);
                        }
                        toast.success('Template Applied', `Loaded ${tests.length} test(s) for ${tmpl.diseaseName}`);
                      }
                    }
                  }}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                >
                  <option value="">Choose disease lab template (e.g. Dengue Workup, Diabetic Profile)...</option>
                  {(labTemplates || []).map((tmpl: any) => {
                    const count = (tmpl.labTestsList || (typeof tmpl.labTests === 'string' ? JSON.parse(tmpl.labTests || '[]') : tmpl.labTests) || []).length;
                    return (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.diseaseName} ({count} tests)
                      </option>
                    );
                  })}
                </select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const testsToSave: any[] = [...selectedCatalogTests.map((t) => ({ name: t.name, code: t.code, price: t.price, category: (t as any).category || 'Pathology' }))];
                  if (customLabTest.trim()) {
                    testsToSave.push({ name: customLabTest.trim(), price: Number(customLabPrice || 0), category: 'Pathology', notes: 'Custom requisition' });
                  }
                  if (testsToSave.length === 0) {
                    toast.error('No Tests Selected', 'Select at least one test from the catalog or add a custom test first.');
                    return;
                  }
                  setNewLabTemplateDisease(diagnosis || '');
                  setNewLabTemplateDescription(labNotes.trim() || `Diagnostic package for ${diagnosis || 'condition'}`);
                  setNewLabTemplateTests(testsToSave);
                  setIsSaveLabTemplateOpen(true);
                }}
                className="text-xs border-purple-300 text-purple-800 hover:bg-purple-100 font-bold shrink-0 shadow-2xs"
              >
                <Bookmark className="w-3.5 h-3.5 mr-1 text-purple-600" /> Save as Template
              </Button>
            </div>

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

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedCatalogTests.length === 0 && !customLabTest.trim()) {
                    toast.error('No Tests Selected', 'Select or enter tests before saving as a template.');
                    return;
                  }
                  const testsToSave = selectedCatalogTests.map((t) => ({
                    name: t.name,
                    code: t.code || '',
                    category: 'Pathology',
                    price: t.price || 0,
                    notes: labNotes || '',
                  }));
                  if (customLabTest.trim()) {
                    testsToSave.push({
                      name: customLabTest.trim(),
                      code: '',
                      category: 'Pathology',
                      price: customLabPrice || 0,
                      notes: labNotes || '',
                    });
                  }
                  setNewLabTemplateDisease(diagnosis || '');
                  setNewLabTemplateDescription(labNotes || '');
                  setNewLabTemplateTests(testsToSave);
                  setIsSaveLabTemplateOpen(true);
                }}
                className="text-xs border-purple-300 text-purple-700 hover:bg-purple-50 font-semibold"
              >
                <Bookmark className="w-3.5 h-3.5 mr-1" /> Save as Template
              </Button>
              <div className="flex gap-2">
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
            </div>
          </form>
        </Modal>
      )}

      {/* SAVE / CREATE LAB TEST TEMPLATE MODAL */}
      {isSaveLabTemplateOpen && (
        <Modal
          isOpen={isSaveLabTemplateOpen}
          onClose={() => {
            setIsSaveLabTemplateOpen(false);
            setNewLabTemplateDisease('');
            setNewLabTemplateDescription('');
            setNewLabTemplateTests([{ name: '', code: '', category: 'Pathology', price: 0, notes: '' }]);
          }}
          title="Save Diagnostic Lab Test Template"
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newLabTemplateDisease.trim()) {
                toast.error('Disease Name Required', 'Please enter a disease or condition name for this lab template.');
                return;
              }
              const validTests = newLabTemplateTests.filter((t) => t.name && t.name.trim());
              if (validTests.length === 0) {
                toast.error('Tests Required', 'Please add at least one lab test to the template.');
                return;
              }
              createLabTemplateMutation.mutate({
                diseaseName: newLabTemplateDisease.trim(),
                description: newLabTemplateDescription.trim() || undefined,
                labTests: validTests.map((t) => ({
                  name: t.name.trim(),
                  code: t.code?.trim() || undefined,
                  category: t.category?.trim() || 'Pathology',
                  price: Number(t.price || 0),
                  notes: t.notes?.trim() || undefined,
                })),
              });
            }}
            className="space-y-4 text-xs"
          >
            <p className="text-slate-500">
              Save a group of diagnostic lab tests as a reusable template for a particular disease (e.g. Dengue Fever, Diabetic Workup, Thyroid Screening).
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Disease / Condition Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newLabTemplateDisease}
                onChange={(e) => setNewLabTemplateDisease(e.target.value)}
                placeholder="e.g. Dengue Fever Workup, Diabetes Mellitus Evaluation, Thyroid Profile"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Clinical Description / Indications (Optional)
              </label>
              <textarea
                rows={2}
                value={newLabTemplateDescription}
                onChange={(e) => setNewLabTemplateDescription(e.target.value)}
                placeholder="e.g. Recommended for patients presenting with high fever, thrombocytopenia, or suspected arboviral infection"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-semibold text-slate-700">
                  Diagnostic Lab Tests in Package <span className="text-rose-500">*</span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setNewLabTemplateTests([
                      ...newLabTemplateTests,
                      { name: '', code: '', category: 'Pathology', price: 0, notes: '' },
                    ])
                  }
                  className="text-[11px] font-bold text-purple-700 border-purple-200 hover:bg-purple-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Test
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto p-1">
                {newLabTemplateTests.map((test, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-6">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Test Name</span>
                        <input
                          type="text"
                          placeholder="e.g. Dengue NS1 Antigen / Platelet Count"
                          value={test.name}
                          onChange={(e) => {
                            const copy = [...newLabTemplateTests];
                            copy[idx].name = e.target.value;
                            setNewLabTemplateTests(copy);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-medium"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Category</span>
                        <select
                          value={test.category || 'Pathology'}
                          onChange={(e) => {
                            const copy = [...newLabTemplateTests];
                            copy[idx].category = e.target.value;
                            setNewLabTemplateTests(copy);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                        >
                          <option value="Pathology">Pathology</option>
                          <option value="Biochemistry">Biochemistry</option>
                          <option value="Hematology">Hematology</option>
                          <option value="Microbiology">Microbiology</option>
                          <option value="Serology">Serology</option>
                          <option value="Radiology">Radiology</option>
                          <option value="General">General</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Est. Price (₹)</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={test.price || ''}
                          onChange={(e) => {
                            const copy = [...newLabTemplateTests];
                            copy[idx].price = Number(e.target.value) || 0;
                            setNewLabTemplateTests(copy);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-1 flex items-end justify-center pt-3 sm:pt-0">
                        {newLabTemplateTests.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewLabTemplateTests(newLabTemplateTests.filter((_, i) => i !== idx));
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded"
                            title="Remove test"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Instructions / Notes (e.g. Fasting sample required, Serum tube)"
                        value={test.notes || ''}
                        onChange={(e) => {
                          const copy = [...newLabTemplateTests];
                          copy[idx].notes = e.target.value;
                          setNewLabTemplateTests(copy);
                        }}
                        className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSaveLabTemplateOpen(false);
                  setNewLabTemplateDisease('');
                  setNewLabTemplateDescription('');
                  setNewLabTemplateTests([{ name: '', code: '', category: 'Pathology', price: 0, notes: '' }]);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                isLoading={createLabTemplateMutation.isPending}
              >
                Save Lab Template
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT LAB TEST TEMPLATE MODAL */}
      {editingLabTemplate && (
        <Modal
          isOpen={!!editingLabTemplate}
          onClose={() => setEditingLabTemplate(null)}
          title={`Edit Lab Template - ${editingLabTemplate.diseaseName}`}
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingLabTemplate.diseaseName.trim()) {
                toast.error('Disease Name Required', 'Disease name cannot be empty');
                return;
              }
              const validTests = (editingLabTemplate.labTests || []).filter((t: any) => t.name && t.name.trim());
              if (validTests.length === 0) {
                toast.error('Tests Required', 'Please have at least one test in this template');
                return;
              }
              updateLabTemplateMutation.mutate({
                id: editingLabTemplate.id,
                data: {
                  diseaseName: editingLabTemplate.diseaseName.trim(),
                  description: editingLabTemplate.description?.trim() || null,
                  labTests: validTests,
                },
              });
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Disease / Condition Name</label>
              <input
                type="text"
                value={editingLabTemplate.diseaseName}
                onChange={(e) =>
                  setEditingLabTemplate({ ...editingLabTemplate, diseaseName: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description / Indications</label>
              <textarea
                rows={2}
                value={editingLabTemplate.description || ''}
                onChange={(e) =>
                  setEditingLabTemplate({ ...editingLabTemplate, description: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-semibold text-slate-700">Diagnostic Tests in Template</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const copy = [...(editingLabTemplate.labTests || [])];
                    copy.push({ name: '', code: '', category: 'Pathology', price: 0, notes: '' });
                    setEditingLabTemplate({ ...editingLabTemplate, labTests: copy });
                  }}
                  className="text-[11px] font-bold text-purple-700 border-purple-200 hover:bg-purple-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Test
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto p-1">
                {(editingLabTemplate.labTests || []).map((test: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-6">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Test Name</span>
                        <input
                          type="text"
                          value={test.name}
                          onChange={(e) => {
                            const copy = [...editingLabTemplate.labTests];
                            copy[idx].name = e.target.value;
                            setEditingLabTemplate({ ...editingLabTemplate, labTests: copy });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-medium"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Category</span>
                        <select
                          value={test.category || 'Pathology'}
                          onChange={(e) => {
                            const copy = [...editingLabTemplate.labTests];
                            copy[idx].category = e.target.value;
                            setEditingLabTemplate({ ...editingLabTemplate, labTests: copy });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                        >
                          <option value="Pathology">Pathology</option>
                          <option value="Biochemistry">Biochemistry</option>
                          <option value="Hematology">Hematology</option>
                          <option value="Microbiology">Microbiology</option>
                          <option value="Serology">Serology</option>
                          <option value="Radiology">Radiology</option>
                          <option value="General">General</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Est. Price (₹)</span>
                        <input
                          type="number"
                          value={test.price || ''}
                          onChange={(e) => {
                            const copy = [...editingLabTemplate.labTests];
                            copy[idx].price = Number(e.target.value) || 0;
                            setEditingLabTemplate({ ...editingLabTemplate, labTests: copy });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-1 flex items-end justify-center pt-3 sm:pt-0">
                        {editingLabTemplate.labTests.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const copy = editingLabTemplate.labTests.filter((_: any, i: number) => i !== idx);
                              setEditingLabTemplate({ ...editingLabTemplate, labTests: copy });
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded"
                            title="Remove test"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Instructions / Notes (optional)"
                        value={test.notes || ''}
                        onChange={(e) => {
                          const copy = [...editingLabTemplate.labTests];
                          copy[idx].notes = e.target.value;
                          setEditingLabTemplate({ ...editingLabTemplate, labTests: copy });
                        }}
                        className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingLabTemplate(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                isLoading={updateLabTemplateMutation.isPending}
              >
                Save Changes
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
