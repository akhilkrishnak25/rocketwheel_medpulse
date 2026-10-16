import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  IndianRupee,
  Bell,
  Search,
  Filter,
  Download,
  Plus,
  Edit2,
  ShieldCheck,
  AlertCircle,
  Activity,
  FileText,
  UserCheck,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Ban,
  Copy,
  RefreshCw,
  Check,
  CheckCircle,
  X,
  UserPlus,
  HeartHandshake,
  Key,
  Stethoscope,
  Printer,
  FileHeart,
  FlaskConical,
  Globe,
  Lock,
  Camera,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  ExternalLink,
  Building2,
  Image as ImageIcon,
  Sparkles,
  MapPin,
  Phone,
  Info,
  Loader2,
  Trash2,
  ListFilter,
  Pill,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/admin.api';
import { uploadApi, getMediaUrl } from '../api/client';
import { appointmentsApi } from '../api/appointments.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { InlineSpinner } from '../components/ui/Loading';
import { Appointment, Doctor } from '../types';

export const HospitalAdminDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, updateUser } = useAuth();

  // Granular Sub-Admin RBAC
  const isSubAdmin = user?.role === 'HOSPITAL_SUB_ADMIN';
  const subPermissions: string[] = user?.subAdminPermissions || [];

  const canManageAppointments = !isSubAdmin || subPermissions.includes('OP_MANAGEMENT');
  const canManageDoctors = !isSubAdmin || subPermissions.includes('DOCTOR_MANAGEMENT');
  const canViewPatients = !isSubAdmin || subPermissions.includes('PATIENT_RECORDS');
  const canManageStaff = !isSubAdmin || subPermissions.includes('VITALS_MANAGEMENT');
  const canManageSubAdmins = !isSubAdmin; // Only Hospital Admin can manage Sub-Admins
  const canManageLabs = !isSubAdmin || subPermissions.includes('LAB_MANAGEMENT');
  const canManagePharmacies = !isSubAdmin || subPermissions.includes('PHARMACY_MANAGEMENT') || subPermissions.includes('OP_MANAGEMENT');

  const [activeTab, setActiveTab] = useState<'appointments' | 'doctors' | 'patients' | 'staff' | 'subadmins' | 'notifications' | 'labs' | 'pharmacies'>('appointments');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [opViewMode, setOpViewMode] = useState<'today' | 'all'>('today');
  const [isExportingCompletedExcel, setIsExportingCompletedExcel] = useState(false);
  const [labViewMode, setLabViewMode] = useState<'catalog' | 'requests'>('catalog');
  const [labRequestDate, setLabRequestDate] = useState<string>('');

  // Hospital Labs Management & Approval State
  const [editingLab, setEditingLab] = useState<any | null>(null);
  const [labSearch, setLabSearch] = useState('');
  const [labFilterStatus, setLabFilterStatus] = useState<string>('ALL');
  const [rejectingLab, setRejectingLab] = useState<any | null>(null);
  const [labRejectReason, setLabRejectReason] = useState<string>('');

  // Hospital Pharmacies Management & Approval State
  const [pharmacyFilter, setPharmacyFilter] = useState<string>('ALL');
  const [pharmacySearch, setPharmacySearch] = useState<string>('');
  const [rejectingPharmacy, setRejectingPharmacy] = useState<any | null>(null);
  const [pharmacyRejectReason, setPharmacyRejectReason] = useState<string>('');

  // Hospital Admin Avatar Upload State (Requirement 20)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Hospital Profile & Branding State
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [brandingLogo, setBrandingLogo] = useState('');
  const [brandingImage, setBrandingImage] = useState('');
  const [brandingPhone, setBrandingPhone] = useState('');
  const [brandingEmergency, setBrandingEmergency] = useState('');
  const [brandingAbout, setBrandingAbout] = useState('');
  const [brandingAddress, setBrandingAddress] = useState('');
  const [brandingCity, setBrandingCity] = useState('');

  // Slip Download State & Handler
  const [downloadingSlipId, setDownloadingSlipId] = useState<string | null>(null);

  const handleDownloadOpSlip = async (appointmentId: string, opNumber?: string) => {
    setDownloadingSlipId(appointmentId);
    try {
      await appointmentsApi.downloadPdf(appointmentId, `Digital_OP_${opNumber || appointmentId}.pdf`);
      toast.success('Download Complete', 'Digital OP Slip PDF downloaded successfully.');
    } catch (err: any) {
      toast.error('Download Failed', err.message || 'Could not download PDF slip');
    } finally {
      setDownloadingSlipId(null);
    }
  };

  // Sync URL hash with activeTab (Requirement 17)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['appointments', 'doctors', 'patients', 'staff', 'subadmins', 'notifications', 'labs', 'pharmacies'].includes(hash)) {
        setActiveTab(hash as any);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (tab: 'appointments' | 'doctors' | 'patients' | 'staff' | 'subadmins' | 'notifications' | 'labs' | 'pharmacies') => {
    setActiveTab(tab);
    window.location.hash = `#${tab}`;
  };

  // Admin Profile Photo & Hospital Branding Upload (Requirement 20)
  const handleProfilePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid Format', 'Please upload an image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File Exceeds Limit', 'Maximum allowed image size is 8MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          // Upload to hospital asset & profile photo
          const result = await uploadApi.uploadHospitalAsset(base64Data, 'both');
          try {
            await adminApi.updateHospitalProfile({
              logoUrl: result.url,
              imageUrl: result.url,
            });
          } catch (profileErr) {
            console.warn('Profile sync fallback:', profileErr);
          }

          updateUser({
            avatarUrl: result.url,
            hospital: user?.hospital
              ? { ...user.hospital, logoUrl: result.url, imageUrl: result.url }
              : undefined,
          });

          queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
          queryClient.invalidateQueries({ queryKey: ['hospitals'] });
          queryClient.invalidateQueries({ queryKey: ['hospital-detail'] });
          queryClient.invalidateQueries({ queryKey: ['super-admin-hospitals'] });

          toast.success('Hospital Image Updated', 'Hospital logo and image updated successfully across the entire platform.');
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
    if (!window.confirm('Remove hospital photo?')) return;
    setIsUploadingPhoto(true);
    try {
      await uploadApi.removeProfilePhoto();
      updateUser({
        avatarUrl: null,
        hospital: user?.hospital ? { ...user.hospital, logoUrl: undefined } : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
      queryClient.invalidateQueries({ queryKey: ['hospital-detail'] });
      toast.success('Photo Removed', 'Hospital photo reset.');
    } catch (err: any) {
      toast.error('Removal Failed', err.message || 'Could not remove photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const openBrandingModal = () => {
    setBrandingLogo(hospitalProfile?.logoUrl || user?.hospital?.logoUrl || user?.avatarUrl || '');
    setBrandingImage(hospitalProfile?.imageUrl || user?.hospital?.imageUrl || '');
    setBrandingPhone(hospitalProfile?.phone || '');
    setBrandingEmergency(hospitalProfile?.emergencyContact || '');
    setBrandingAbout(hospitalProfile?.about || '');
    setBrandingAddress(hospitalProfile?.address || '');
    setBrandingCity(hospitalProfile?.city || '');
    setIsBrandingModalOpen(true);
  };

  const handleBannerUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid Format', 'Please upload an image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File Exceeds Limit', 'Maximum allowed image size is 8MB.');
      return;
    }
    setIsUploadingBanner(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await uploadApi.uploadHospitalAsset(base64Data, 'cover');
          setBrandingImage(res.url);
          toast.success('Cover Photo Uploaded', 'Hospital cover photo uploaded. Click "Save Hospital Profile" to apply.');
        } catch (err: any) {
          toast.error('Upload Failed', err.message || 'Could not upload cover photo');
        } finally {
          setIsUploadingBanner(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error('Upload Failed', err.message);
      setIsUploadingBanner(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid Format', 'Please upload an image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File Exceeds Limit', 'Maximum allowed image size is 5MB.');
      return;
    }
    setIsUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await uploadApi.uploadHospitalAsset(base64Data, 'logo');
          setBrandingLogo(res.url);
          toast.success('Logo Uploaded', 'Hospital emblem uploaded. Click "Save Hospital Profile" to apply.');
        } catch (err: any) {
          toast.error('Upload Failed', err.message || 'Could not upload logo');
        } finally {
          setIsUploadingLogo(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error('Upload Failed', err.message);
      setIsUploadingLogo(false);
    }
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      await adminApi.updateHospitalProfile({
        logoUrl: brandingLogo.trim() || undefined,
        imageUrl: brandingImage.trim() || undefined,
        phone: brandingPhone.trim() || undefined,
        emergencyContact: brandingEmergency.trim() || undefined,
        about: brandingAbout.trim() || undefined,
        address: brandingAddress.trim() || undefined,
        city: brandingCity.trim() || undefined,
      });

      updateUser({
        avatarUrl: brandingLogo.trim() || brandingImage.trim() || user?.avatarUrl,
        hospital: user?.hospital
          ? {
              ...user.hospital,
              logoUrl: brandingLogo.trim() || user.hospital.logoUrl,
              imageUrl: brandingImage.trim() || user.hospital.imageUrl,
            }
          : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
      queryClient.invalidateQueries({ queryKey: ['hospital-detail'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-hospitals'] });

      toast.success('Hospital Profile Updated', 'Hospital branding and details saved successfully.');
      setIsBrandingModalOpen(false);
    } catch (err: any) {
      toast.error('Save Failed', err.message || 'Could not update hospital profile');
    } finally {
      setIsSavingBranding(false);
    }
  };

  // Offline OP Booking States
  const [isOfflineBookingOpen, setIsOfflineBookingOpen] = useState(false);
  const [offlineDoctorId, setOfflineDoctorId] = useState('');
  const [offlinePatientName, setOfflinePatientName] = useState('');
  const [offlineMobile, setOfflineMobile] = useState('');
  const [offlineEmail, setOfflineEmail] = useState('');
  const [offlineAge, setOfflineAge] = useState<number | ''>('');
  const [offlineGender, setOfflineGender] = useState('MALE');
  const [offlineBloodGroup, setOfflineBloodGroup] = useState('O+');
  const [offlineAddress, setOfflineAddress] = useState('');
  const [offlineEmergencyContact, setOfflineEmergencyContact] = useState('');
  const [offlineFee, setOfflineFee] = useState<number>(500);
  const [offlineNotes, setOfflineNotes] = useState('');
  const [createdOfflineBooking, setCreatedOfflineBooking] = useState<any | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingAppointmentsExcel, setIsExportingAppointmentsExcel] = useState(false);
  const [isExportingPatientsExcel, setIsExportingPatientsExcel] = useState(false);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const blob = await adminApi.exportAllDataExcel();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const safeHospName = (hospitalProfile?.name || user?.hospital?.name || 'Hospital').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `MedPulse_${safeHospName}_AllData_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Excel Export Successful', 'All hospital records (Appointments, Doctors, Departments, Staff, Patients) exported to Excel (.xlsx)');
    } catch (err: any) {
      toast.error('Excel Export Failed', err.message || 'Could not export Excel file');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportAppointmentsExcel = async () => {
    setIsExportingAppointmentsExcel(true);
    try {
      const effectiveDate = opViewMode === 'today' ? new Date().toISOString().split('T')[0] : (selectedDate || undefined);
      const blob = await adminApi.exportAppointmentsExcel({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        date: effectiveDate,
        search: searchQuery || undefined,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const safeHospName = (hospitalProfile?.name || user?.hospital?.name || 'Hospital').replace(/[^a-zA-Z0-9]/g, '_');
      const todayStr = new Date().toISOString().split('T')[0];
      a.download = `MedPulse_${safeHospName}_Appointments_${todayStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(
        'Appointments Export Successful',
        'Hospital appointments list exported to Excel (.xlsx)'
      );
    } catch (err: any) {
      toast.error('Appointments Export Failed', err.message || 'Could not export appointments Excel');
    } finally {
      setIsExportingAppointmentsExcel(false);
    }
  };

  const handleExportCompletedAppointmentsExcel = async () => {
    setIsExportingCompletedExcel(true);
    try {
      const effectiveDate = opViewMode === 'today' ? new Date().toISOString().split('T')[0] : (selectedDate || undefined);
      const blob = await adminApi.exportAppointmentsExcel({
        status: 'COMPLETED',
        date: effectiveDate,
        search: searchQuery || undefined,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const safeHospName = (hospitalProfile?.name || user?.hospital?.name || 'Hospital').replace(/[^a-zA-Z0-9]/g, '_');
      const todayStr = new Date().toISOString().split('T')[0];
      a.download = `MedPulse_${safeHospName}_Completed_Appointments_${todayStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(
        'Completed Appointments Exported',
        'Completed OPD consultations list exported to Excel (.xlsx)'
      );
    } catch (err: any) {
      toast.error('Completed Appointments Export Failed', err.message || 'Could not export completed appointments');
    } finally {
      setIsExportingCompletedExcel(false);
    }
  };

  const handleExportPatientsExcel = async () => {
    setIsExportingPatientsExcel(true);
    try {
      const blob = await adminApi.exportPatientsExcel({
        search: patientSearch || undefined,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const safeHospName = (hospitalProfile?.name || user?.hospital?.name || 'Hospital').replace(/[^a-zA-Z0-9]/g, '_');
      const todayStr = new Date().toISOString().split('T')[0];
      a.download = `MedPulse_${safeHospName}_Patients_${todayStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(
        'Patients Export Successful',
        'Hospital patient directory records exported to Excel (.xlsx)'
      );
    } catch (err: any) {
      toast.error('Patients Export Failed', err.message || 'Could not export patient records Excel');
    } finally {
      setIsExportingPatientsExcel(false);
    }
  };

  // Patient Records States
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Support Staff States
  const [staffSearch, setStaffSearch] = useState('');

  // Sub-Admin States
  const [isCreateSubAdminOpen, setIsCreateSubAdminOpen] = useState(false);
  const [subAdminName, setSubAdminName] = useState('');
  const [subAdminEmail, setSubAdminEmail] = useState('');
  const [subAdminPassword, setSubAdminPassword] = useState('Password@123');
  const [subAdminPhone, setSubAdminPhone] = useState('');
  const [subAdminRoleTitle, setSubAdminRoleTitle] = useState('Hospital Sub-Administrator');
  const [subAdminPermissionsState, setSubAdminPermissionsState] = useState<string[]>([
    'OP_MANAGEMENT',
    'PATIENT_RECORDS',
  ]);
  const [editingSubAdmin, setEditingSubAdmin] = useState<any | null>(null);

  // Doctor modal states
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);

  // Doctor approval, status & bulk import states
  const [doctorFilterStatus, setDoctorFilterStatus] = useState<string>('ALL');
  const [doctorSearch, setDoctorSearch] = useState<string>('');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [bulkPreviewResult, setBulkPreviewResult] = useState<any>(null);
  const [rejectingDoctor, setRejectingDoctor] = useState<Doctor | null>(null);
  const [doctorRejectReason, setDoctorRejectReason] = useState('');

  // New Doctor Form State
  const [newDocData, setNewDocData] = useState({
    name: '',
    departmentId: '',
    specialization: '',
    qualification: '',
    experienceYears: 5,
    consultationFee: 500,
    languages: 'English, Hindi',
    workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    about: '',
  });
  const [doctorAccountEmail, setDoctorAccountEmail] = useState('');
  const [doctorAccountPhone, setDoctorAccountPhone] = useState('');
  const [doctorAccountPassword, setDoctorAccountPassword] = useState('Password@123');
  const [createdDoctorCredentials, setCreatedDoctorCredentials] = useState<{
    name: string;
    email: string;
    password?: string;
  } | null>(null);

  // New Department Form State
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');

  // Fetch metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => adminApi.getMetrics(),
    refetchInterval: 10000,
  });

  const todayDateStr = new Date().toISOString().split('T')[0];
  const effectiveAppointmentsDate = opViewMode === 'today' ? todayDateStr : (selectedDate || undefined);

  // Fetch appointments
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['admin-appointments', statusFilter, searchQuery, opViewMode, effectiveAppointmentsDate],
    queryFn: () =>
      adminApi.getAppointments({
        status: statusFilter,
        search: searchQuery || undefined,
        date: effectiveAppointmentsDate,
      }),
    refetchInterval: 10000,
  });

  // Fetch doctors
  const { data: doctors, isLoading: doctorsLoading } = useQuery({
    queryKey: ['admin-doctors'],
    queryFn: () => adminApi.getDoctors(),
  });

  // Fetch departments
  const { data: departments, refetch: refetchDepartments } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => adminApi.getDepartments(),
  });

  // Fetch notifications
  const { data: notifications, refetch: refetchNotifications } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => adminApi.getNotifications(),
    refetchInterval: 10000,
  });

  // Fetch hospital profile & branding
  const { data: hospitalProfile, refetch: refetchHospitalProfile } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: () => adminApi.getHospitalProfile(),
  });

  // Immediate popup/toast notifications when new alerts arrive (Requirement 13)
  const prevNotifIdsRef = useRef<Set<string>>(new Set());
  const isInitialNotifMount = useRef(true);

  useEffect(() => {
    if (!notifications || !Array.isArray(notifications)) return;
    if (isInitialNotifMount.current) {
      prevNotifIdsRef.current = new Set(notifications.map((n: any) => n.id));
      isInitialNotifMount.current = false;
      return;
    }

    for (const notif of notifications) {
      if (!prevNotifIdsRef.current.has(notif.id)) {
        prevNotifIdsRef.current.add(notif.id);
        const title = notif.title || 'System Notification';
        const msg = notif.message ? notif.message.split('\n')[0] : '';
        if (notif.type?.includes('REJECT') || notif.type?.includes('CANCEL')) {
          toast.error(title, msg);
        } else if (
          notif.type?.includes('APPROV') ||
          notif.type?.includes('CONFIRM') ||
          notif.type?.includes('COMPLETED') ||
          notif.type?.includes('BOOKED')
        ) {
          toast.success(title, msg);
        } else {
          toast.info(title, msg);
        }
      }
    }
  }, [notifications, toast]);

  // Fetch pending doctors
  const { data: pendingDoctors } = useQuery({
    queryKey: ['admin-pending-doctors'],
    queryFn: () => adminApi.getPendingDoctors(),
    enabled: canManageDoctors,
    refetchInterval: 10000,
  });

  // Fetch hospital-scoped patients
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ['admin-patients', patientSearch],
    queryFn: () => adminApi.getHospitalPatients({ search: patientSearch || undefined }),
    enabled: activeTab === 'patients' && canViewPatients,
  });

  // Fetch patient details drawer
  const { data: patientDetails, isLoading: patientDetailsLoading } = useQuery({
    queryKey: ['admin-patient-detail', selectedPatientId],
    queryFn: () => adminApi.getPatientDetails(selectedPatientId!),
    enabled: !!selectedPatientId,
  });

  // Fetch support staff
  const { data: supportStaffList, isLoading: staffLoading } = useQuery({
    queryKey: ['admin-support-staff', staffSearch],
    queryFn: () => adminApi.getSupportStaff({ search: staffSearch || undefined }),
    enabled: activeTab === 'staff' && canManageStaff,
  });

  // Fetch sub-administrators
  const { data: subAdminsList, isLoading: subAdminsLoading } = useQuery({
    queryKey: ['admin-sub-admins'],
    queryFn: () => adminApi.getSubAdmins(),
    enabled: activeTab === 'subadmins' && canManageSubAdmins,
  });

  // Fetch hospital diagnostic laboratories (Requirement 6)
  const { data: hospitalLabs, isLoading: labsLoading, refetch: refetchLabs } = useQuery({
    queryKey: ['admin-labs'],
    queryFn: () => adminApi.getLabs(),
    enabled: activeTab === 'labs' && canManageLabs,
  });

  const updateLabVisibilityMutation = useMutation({
    mutationFn: ({ labId, visibility }: { labId: string; visibility: 'PUBLIC' | 'PRIVATE' }) =>
      adminApi.updateLabVisibility(labId, visibility),
    onSuccess: (_, vars) => {
      toast.success(
        'Laboratory Visibility Updated',
        `Lab visibility is now ${vars.visibility} (${vars.visibility === 'PUBLIC' ? 'Publicly listed for patient direct booking' : 'Private to hospital clinical referrals'})`
      );
      queryClient.invalidateQueries({ queryKey: ['admin-labs'] });
    },
    onError: (err: any) => {
      toast.error('Failed to Update Visibility', err.message);
    },
  });

  const updateLabMutation = useMutation({
    mutationFn: ({ labId, data }: { labId: string; data: any }) =>
      adminApi.updateLab(labId, data),
    onSuccess: () => {
      toast.success('Laboratory Updated', 'Hospital lab profile updated successfully');
      setEditingLab(null);
      queryClient.invalidateQueries({ queryKey: ['admin-labs'] });
    },
    onError: (err: any) => {
      toast.error('Update Failed', err.message);
    },
  });

  const deleteLabMutation = useMutation({
    mutationFn: (labId: string) => adminApi.deleteLab(labId),
    onSuccess: () => {
      toast.success('Laboratory Deleted', 'Laboratory record removed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-labs'] });
    },
    onError: (err: any) => {
      toast.error('Delete Failed', err?.response?.data?.message || err?.message || 'Could not delete laboratory');
    },
  });

  // Hospital Diagnostic Laboratories Approval & Rejection Mutations
  const approveHospitalLabMutation = useMutation({
    mutationFn: (labId: string) => adminApi.approveLab(labId),
    onSuccess: () => {
      toast.success('Hospital Laboratory Approved', 'Diagnostic laboratory verified and activated.');
      queryClient.invalidateQueries({ queryKey: ['admin-labs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Approval Failed', err?.response?.data?.message || err.message || 'Could not approve laboratory');
    },
  });

  const rejectHospitalLabMutation = useMutation({
    mutationFn: ({ labId, reason }: { labId: string; reason?: string }) =>
      adminApi.rejectLab(labId, reason),
    onSuccess: () => {
      toast.info('Laboratory Rejected', 'Laboratory registration application has been rejected.');
      setRejectingLab(null);
      setLabRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-labs'] });
    },
    onError: (err: any) => {
      toast.error('Rejection Failed', err?.response?.data?.message || err.message || 'Could not reject laboratory');
    },
  });

  // Fetch hospital pharmacies
  const { data: hospitalPharmacies, isLoading: pharmaciesLoading, refetch: refetchPharmacies } = useQuery({
    queryKey: ['admin-pharmacies'],
    queryFn: () => adminApi.getPharmacies(),
    enabled: (activeTab === 'pharmacies' || activeTab === 'notifications') && canManagePharmacies,
    refetchInterval: 12000,
  });

  const approvePharmacyMutation = useMutation({
    mutationFn: (pharmacyId: string) => adminApi.approvePharmacy(pharmacyId),
    onSuccess: () => {
      toast.success('Pharmacy Registration Approved', 'Dispensary and pharmacist staff account activated.');
      queryClient.invalidateQueries({ queryKey: ['admin-pharmacies'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Approval Failed', err?.response?.data?.message || err.message || 'Could not approve pharmacy');
    },
  });

  const rejectPharmacyMutation = useMutation({
    mutationFn: ({ pharmacyId, reason }: { pharmacyId: string; reason?: string }) =>
      adminApi.rejectPharmacy(pharmacyId, reason),
    onSuccess: () => {
      toast.info('Pharmacy Rejected', 'Pharmacy registration application has been rejected.');
      setRejectingPharmacy(null);
      setPharmacyRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-pharmacies'] });
    },
    onError: (err: any) => {
      toast.error('Rejection Failed', err?.response?.data?.message || err.message || 'Could not reject pharmacy');
    },
  });

  const togglePharmacyStatusMutation = useMutation({
    mutationFn: (pharmacyId: string) => adminApi.togglePharmacyStatus(pharmacyId),
    onSuccess: () => {
      toast.success('Pharmacy Status Updated', 'Pharmacy operational status changed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-pharmacies'] });
    },
    onError: (err: any) => {
      toast.error('Status Update Failed', err?.response?.data?.message || err.message);
    },
  });

  // Doctor Laboratory Test Requests for this hospital (by Date)
  const { data: adminLabRequests, isLoading: adminLabRequestsLoading, refetch: refetchAdminLabRequests } = useQuery({
    queryKey: ['admin-lab-requests', labRequestDate],
    queryFn: () => adminApi.getHospitalLabRequests(labRequestDate || undefined),
    enabled: activeTab === 'labs' && canManageLabs && labViewMode === 'requests',
  });

  // Offline OP Booking Mutation
  const createOfflineBookingMutation = useMutation({
    mutationFn: (data: any) => adminApi.createOfflineAppointment(data),
    onSuccess: (res: any) => {
      const apt = res.data;
      toast.success('Offline Walk-in OP Booked', `Token #${apt?.tokenNumber} issued successfully`);
      setCreatedOfflineBooking(apt);
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-patients'] });
    },
    onError: (err: any) => {
      toast.error('Booking Failed', err.message || 'Could not create offline booking');
    },
  });

  // Support Staff Approval / Rejection Mutations
  const approveStaffMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveSupportStaff(id),
    onSuccess: () => {
      toast.success('Support Staff Approved', 'Staff member verified for clinical vitals screening');
      queryClient.invalidateQueries({ queryKey: ['admin-support-staff'] });
    },
    onError: (err: any) => {
      toast.error('Staff Approval Failed', err.message);
    },
  });

  const rejectStaffMutation = useMutation({
    mutationFn: (id: string) => adminApi.rejectSupportStaff(id),
    onSuccess: () => {
      toast.info('Staff Application Rejected', 'Staff registration application rejected');
      queryClient.invalidateQueries({ queryKey: ['admin-support-staff'] });
    },
    onError: (err: any) => {
      toast.error('Staff Rejection Failed', err.message);
    },
  });

  // Sub-Administrator Mutations
  const createSubAdminMutation = useMutation({
    mutationFn: (data: any) => adminApi.createSubAdmin(data),
    onSuccess: () => {
      toast.success('Sub-Administrator Created', 'Hospital sub-admin credentials configured');
      setIsCreateSubAdminOpen(false);
      setSubAdminName('');
      setSubAdminEmail('');
      setSubAdminPassword('Password@123');
      setSubAdminPhone('');
      setSubAdminRoleTitle('Hospital Sub-Administrator');
      setSubAdminPermissionsState(['OP_MANAGEMENT', 'PATIENT_RECORDS']);
      queryClient.invalidateQueries({ queryKey: ['admin-sub-admins'] });
    },
    onError: (err: any) => {
      toast.error('Sub-Admin Creation Failed', err.message);
    },
  });

  const updateSubAdminMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateSubAdminPermissions(id, data),
    onSuccess: () => {
      toast.success('Permissions Updated', 'Sub-admin granular privileges updated successfully');
      setEditingSubAdmin(null);
      queryClient.invalidateQueries({ queryKey: ['admin-sub-admins'] });
    },
    onError: (err: any) => {
      toast.error('Update Failed', err.message);
    },
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateAppointmentStatus(id, status),
    onSuccess: (_, variables) => {
      toast.success(`Appointment status updated to ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Failed to update status', err.message);
    },
  });

  // Add doctor mutation
  const addDoctorMutation = useMutation({
    mutationFn: (data: any) => adminApi.addDoctor(data),
    onSuccess: (data: any) => {
      toast.success('Doctor registered successfully');
      setIsAddDoctorOpen(false);
      if (data?.initialCredentials?.email) {
        setCreatedDoctorCredentials({
          name: data.name || newDocData.name,
          email: data.initialCredentials.email,
          password: data.initialCredentials.password,
        });
      }
      setNewDocData({
        name: '',
        departmentId: '',
        specialization: '',
        qualification: '',
        experienceYears: 5,
        consultationFee: 500,
        languages: 'English, Hindi',
        workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        about: '',
      });
      setDoctorAccountEmail('');
      setDoctorAccountPhone('');
      setDoctorAccountPassword(`Doc@${Math.floor(100000 + Math.random() * 900000)}`);
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Failed to add doctor', err.message);
    },
  });

  // Add department mutation
  const addDepartmentMutation = useMutation({
    mutationFn: (data: { name: string; code: string; description?: string }) =>
      adminApi.addDepartment(data),
    onSuccess: () => {
      toast.success('Department created successfully');
      setIsAddDeptOpen(false);
      setNewDeptName('');
      setNewDeptCode('');
      setNewDeptDesc('');
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
    },
    onError: (err: any) => {
      toast.error('Failed to create department', err.message);
    },
  });

  // Update doctor mutation
  const updateDoctorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminApi.updateDoctor(id, data),
    onSuccess: () => {
      toast.success('Doctor details updated');
      setEditingDoctor(null);
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
    },
    onError: (err: any) => {
      toast.error('Failed to update doctor', err.message);
    },
  });

  // Approve doctor mutation
  const approveDoctorMutation = useMutation({
    mutationFn: (doctorId: string) => adminApi.approveDoctor(doctorId),
    onSuccess: () => {
      toast.success('Doctor credentials verified and activated');
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Failed to approve doctor', err.message);
    },
  });

  // Reject doctor mutation
  const rejectDoctorMutation = useMutation({
    mutationFn: ({ doctorId, reason }: { doctorId: string; reason?: string }) =>
      adminApi.rejectDoctor(doctorId, reason),
    onSuccess: () => {
      toast.success('Doctor application rejected');
      setRejectingDoctor(null);
      setDoctorRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Failed to reject doctor', err.message);
    },
  });

  // Toggle doctor status mutation
  const toggleDoctorStatusMutation = useMutation({
    mutationFn: (doctorId: string) => adminApi.toggleDoctorStatus(doctorId),
    onSuccess: () => {
      toast.success('Doctor status toggled successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Failed to update doctor status', err.message);
    },
  });

  // Delete doctor mutation
  const deleteDoctorMutation = useMutation({
    mutationFn: (doctorId: string) => adminApi.deleteDoctor(doctorId),
    onSuccess: (data: any) => {
      toast.success('Doctor Removed', data?.message || 'Doctor account removed from active records.');
      setDoctorToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Failed to Delete Doctor', err.message);
    },
  });

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: ({ commit }: { commit: boolean }) =>
      adminApi.bulkImportDoctors({ csvData, commit }),
    onSuccess: (data: any, variables) => {
      if (variables.commit) {
        toast.success(`Successfully imported ${data.imported || data.validCount} doctors`);
        setIsBulkImportOpen(false);
        setCsvData('');
        setBulkPreviewResult(null);
        queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
        queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      } else {
        setBulkPreviewResult(data);
        if (data.errorCount > 0) {
          toast.info(`Validation completed: ${data.validCount} valid, ${data.errorCount} row(s) have errors`);
        } else {
          toast.success(`Validation passed! All ${data.validCount} doctors ready to import`);
        }
      }
    },
    onError: (err: any) => {
      toast.error('Bulk import failed', err.message);
    },
  });

  const getDoctorStatusBadge = (doc: Doctor) => {
    const status = doc.status || (doc.isActive ? 'ACTIVE' : 'SUSPENDED');
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">ACTIVE</Badge>;
      case 'PENDING':
        return <Badge variant="warning">PENDING APPROVAL</Badge>;
      case 'SUSPENDED':
        return <Badge variant="danger">SUSPENDED</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">REJECTED</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge variant="info">CONFIRMED</Badge>;
      case 'WAITING':
        return <Badge variant="warning">WAITING</Badge>;
      case 'IN_CONSULTATION':
        return <Badge variant="purple">IN CONSULTATION</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">CANCELLED</Badge>;
      case 'NO_SHOW':
        return <Badge variant="default">NO SHOW</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER WITH ADMIN AVATAR (Requirement 20) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-royal-50 border-2 border-royal-200 flex items-center justify-center text-royal-700 shadow-inner">
              {hospitalProfile?.logoUrl || user?.hospital?.logoUrl || user?.avatarUrl || hospitalProfile?.imageUrl ? (
                <img
                  src={getMediaUrl(hospitalProfile?.logoUrl || user?.hospital?.logoUrl || user?.avatarUrl || hospitalProfile?.imageUrl)}
                  alt="Hospital Emblem"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <ShieldCheck className="w-8 h-8 text-royal-600" />
              )}
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                  <InlineSpinner size="sm" className="text-royal-600" />
                </div>
              )}
            </div>

            <label
              htmlFor="admin-avatar-file-input"
              className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-royal-600 hover:bg-royal-700 text-white rounded-lg shadow-md cursor-pointer transition-all hover:scale-105"
              title="Upload Hospital Logo & Image"
            >
              <Camera className="w-3.5 h-3.5" />
              <input
                type="file"
                id="admin-avatar-file-input"
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

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {hospitalProfile?.name || user?.hospital?.name || 'Hospital Admin Operations Portal'}
              </h1>
              <Badge variant="purple" className="text-[10px]">
                {isSubAdmin ? (user?.hospitalSubAdmin?.roleTitle || 'Hospital Sub-Admin') : 'Hospital Admin'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Admin: <span className="font-semibold text-slate-700">{user?.name}</span> ({user?.email}) • Code: <span className="font-mono font-bold text-royal-700">{hospitalProfile?.code || user?.hospital?.code || 'RW-HOSP'}</span>
              {(hospitalProfile?.city || hospitalProfile?.phone) && (
                <span className="ml-2 font-medium text-slate-400">
                  • {hospitalProfile?.city} {hospitalProfile?.phone ? `(${hospitalProfile.phone})` : ''}
                </span>
              )}
            </p>
            {(user?.avatarUrl || hospitalProfile?.logoUrl || hospitalProfile?.imageUrl) && (
              <div className="flex items-center gap-3 mt-0.5">
                <button
                  type="button"
                  onClick={handleProfilePhotoRemove}
                  disabled={isUploadingPhoto}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold underline inline-block"
                >
                  Reset image
                </button>
                <button
                  type="button"
                  onClick={openBrandingModal}
                  className="text-[11px] text-royal-600 hover:text-royal-800 font-semibold underline inline-block"
                >
                  Manage Branding & Cover
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* HOSPITAL BRANDING & SETTINGS BUTTON */}
          <Button
            variant="outline"
            onClick={openBrandingModal}
            className="border-royal-200 text-royal-700 hover:bg-royal-50 font-bold text-xs flex items-center gap-1.5 shadow-sm"
            size="sm"
          >
            <Building2 className="w-4 h-4 text-royal-600" />
            Hospital Branding
          </Button>

          {/* EXPORT ALL DATA TO EXCEL BUTTON */}
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 font-bold text-xs flex items-center gap-1.5 shadow-sm"
            size="sm"
            title="Export all hospital data to Excel (.xlsx) including Appointments, Doctors, Departments, Staff, and Patients"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {isExportingExcel ? 'Exporting...' : 'Export to Excel (.xlsx)'}
          </Button>

          {/* OFFLINE WALK-IN BOOKING BUTTON */}
          {canManageAppointments && (
            <Button
              onClick={() => {
                setCreatedOfflineBooking(null);
                setOfflineDoctorId(doctors?.[0]?.id || '');
                setOfflineFee(doctors?.[0]?.consultationFee || 500);
                setIsOfflineBookingOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              size="sm"
            >
              <UserPlus className="w-4 h-4" />
              Offline Walk-in OP Booking
            </Button>
          )}

          {/* Section Tabs (Requirement 17: Hash Synced Navigation) */}
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar whitespace-nowrap">
            {canManageAppointments && (
              <button
                onClick={() => handleTabChange('appointments')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 ${
                  activeTab === 'appointments' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Appointments ({appointments ? appointments.length : (metrics?.totalAppointments ?? metrics?.todayAppointments ?? 0)})
              </button>
            )}

            {canManageDoctors && (
              <button
                onClick={() => handleTabChange('doctors')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'doctors' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Doctors ({metrics?.doctorCount || 0})
                {(pendingDoctors || []).length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                    {(pendingDoctors || []).length}
                  </span>
                )}
              </button>
            )}

            {canViewPatients && (
              <button
                onClick={() => handleTabChange('patients')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'patients' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-royal-600" />
                Patient Records
              </button>
            )}

            {canManageStaff && (
              <button
                onClick={() => handleTabChange('staff')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'staff' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                Support Staff
              </button>
            )}

            {canManageLabs && (
              <button
                onClick={() => handleTabChange('labs')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'labs' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                Hospital Labs ({(hospitalLabs || []).length})
                {(hospitalLabs || []).filter((l: any) => l.status === 'PENDING').length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                    {(hospitalLabs || []).filter((l: any) => l.status === 'PENDING').length}
                  </span>
                )}
              </button>
            )}

            {canManagePharmacies && (
              <button
                onClick={() => handleTabChange('pharmacies')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'pharmacies' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Pill className="w-3.5 h-3.5 text-emerald-600" />
                Pharmacies ({(hospitalPharmacies || []).length})
                {(hospitalPharmacies || []).filter((p: any) => p.status === 'PENDING').length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                    {(hospitalPharmacies || []).filter((p: any) => p.status === 'PENDING').length}
                  </span>
                )}
              </button>
            )}

            {canManageSubAdmins && (
              <button
                onClick={() => handleTabChange('subadmins')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'subadmins' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-indigo-600" />
                Sub-Admins
              </button>
            )}

            <button
              onClick={() => handleTabChange('notifications')}
              className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                activeTab === 'notifications' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-pink-500" />
              Notifications
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS (Requirement 17: Interactive Filters) */}
      <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-4 lg:grid-cols-7 gap-3 pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => {
            handleTabChange('appointments');
            setOpViewMode('today');
            setSelectedDate('');
            setStatusFilter('ALL');
          }}
          className={`min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border text-left shadow-sm space-y-1 shrink-0 sm:shrink transition-all hover:border-royal-400 hover:shadow-md cursor-pointer ${
            activeTab === 'appointments' && opViewMode === 'today' && statusFilter === 'ALL'
              ? 'border-royal-500 ring-2 ring-royal-200'
              : 'border-slate-200'
          }`}
          title="Click to view today's appointments"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Today's Total</span>
          <div className="text-2xl font-black text-slate-900">{metrics?.todayAppointments || 0}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            handleTabChange('appointments');
            setStatusFilter('CONFIRMED');
          }}
          className={`min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border text-left shadow-sm space-y-1 shrink-0 sm:shrink transition-all hover:border-royal-400 hover:shadow-md cursor-pointer ${
            activeTab === 'appointments' && statusFilter === 'CONFIRMED'
              ? 'border-royal-500 ring-2 ring-royal-200'
              : 'border-slate-200'
          }`}
          title="Click to filter Confirmed / Upcoming"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Upcoming</span>
          <div className="text-2xl font-black text-royal-600">{metrics?.upcomingAppointments || 0}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            handleTabChange('appointments');
            setStatusFilter('WAITING');
          }}
          className={`min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border text-left shadow-sm space-y-1 shrink-0 sm:shrink transition-all hover:border-amber-400 hover:shadow-md cursor-pointer ${
            activeTab === 'appointments' && statusFilter === 'WAITING'
              ? 'border-amber-500 ring-2 ring-amber-200'
              : 'border-slate-200'
          }`}
          title="Click to filter Waiting in OPD"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Waiting in OPD</span>
          <div className="text-2xl font-black text-amber-600">
            {metrics?.waitingAppointments !== undefined ? metrics.waitingAppointments : (appointments || []).filter((a) => a.status === 'WAITING').length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            handleTabChange('appointments');
            setStatusFilter('COMPLETED');
          }}
          className={`min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border text-left shadow-sm space-y-1 shrink-0 sm:shrink transition-all hover:border-emerald-400 hover:shadow-md cursor-pointer ${
            activeTab === 'appointments' && statusFilter === 'COMPLETED'
              ? 'border-emerald-500 ring-2 ring-emerald-200'
              : 'border-slate-200'
          }`}
          title="Click to filter Completed appointments"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Completed</span>
          <div className="text-2xl font-black text-emerald-600">{metrics?.completedAppointments || 0}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            handleTabChange('appointments');
            setStatusFilter('CANCELLED');
          }}
          className={`min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border text-left shadow-sm space-y-1 shrink-0 sm:shrink transition-all hover:border-rose-400 hover:shadow-md cursor-pointer ${
            activeTab === 'appointments' && statusFilter === 'CANCELLED'
              ? 'border-rose-500 ring-2 ring-rose-200'
              : 'border-slate-200'
          }`}
          title="Click to filter Cancelled appointments"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Cancelled</span>
          <div className="text-2xl font-black text-rose-600">{metrics?.cancelledAppointments || 0}</div>
        </button>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Today's Revenue</span>
          <div className="text-2xl font-black text-royal-700">₹{metrics?.todayRevenue || 0}</div>
        </div>

        <button
          type="button"
          onClick={() => handleTabChange('patients')}
          className={`min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border text-left shadow-sm space-y-1 shrink-0 sm:shrink transition-all hover:border-royal-400 hover:shadow-md cursor-pointer ${
            activeTab === 'patients'
              ? 'border-royal-500 ring-2 ring-royal-200'
              : 'border-slate-200'
          }`}
          title="Click to view Patient Records"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Patients</span>
          <div className="text-2xl font-black text-slate-900">{metrics?.patientCount || 0}</div>
        </button>
      </div>

      {/* TAB 1: APPOINTMENTS MANAGEMENT */}
      {activeTab === 'appointments' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm space-y-4">
          {/* Filters Bar */}
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Today's OPs vs All OPs View Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpViewMode('today');
                    setSelectedDate('');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    opViewMode === 'today'
                      ? 'bg-royal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="View only today's scheduled OP appointments"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Today's OPs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpViewMode('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    opViewMode === 'all'
                      ? 'bg-royal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="View appointments across all dates"
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>All OPs</span>
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="WAITING">Waiting (Arrived)</option>
                  <option value="IN_CONSULTATION">In Consultation</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold">Date:</span>
                <input
                  type="date"
                  value={opViewMode === 'today' ? todayDateStr : selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    if (e.target.value !== todayDateStr) {
                      setOpViewMode('all');
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-medium"
                />
                {selectedDate ? (
                  <button
                    type="button"
                    onClick={() => setSelectedDate('')}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-2 py-1 rounded transition-colors"
                    title="Clear date filter to show all appointments"
                  >
                    Clear
                  </button>
                ) : opViewMode === 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpViewMode('today');
                      setSelectedDate('');
                    }}
                    className="text-[11px] font-bold text-royal-700 hover:text-royal-900 bg-royal-50 border border-royal-200 hover:bg-royal-100 px-2 py-1 rounded transition-colors"
                    title="Filter today's appointments"
                  >
                    Today
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Input */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full sm:w-60">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patient, mobile, OP..."
                  className="w-full bg-transparent focus:outline-none text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* EXPORT COMPLETED APPOINTMENTS TO EXCEL BUTTON */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCompletedAppointmentsExcel}
                disabled={isExportingCompletedExcel}
                className="border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100 hover:border-teal-400 font-bold text-xs flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                title="Export completed appointments to Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                {isExportingCompletedExcel ? 'Exporting...' : 'Export Completed OPs (.xlsx)'}
              </Button>

              {/* EXPORT APPOINTMENTS TO EXCEL BUTTON */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAppointmentsExcel}
                disabled={isExportingAppointmentsExcel}
                className="border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 font-bold text-xs flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                title="Export appointments to Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                {isExportingAppointmentsExcel ? 'Exporting...' : 'Export Appointments (.xlsx)'}
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Token</th>
                  <th className="px-5 py-3.5">Patient Details</th>
                  <th className="px-5 py-3.5">Doctor & Dept</th>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">OP Slip</th>
                  <th className="px-5 py-3.5">Payment</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Follow-up Date</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap min-w-[210px]">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {appointmentsLoading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400">
                      Loading appointments...
                    </td>
                  </tr>
                ) : !appointments || appointments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      No appointments matching the specified filters.
                    </td>
                  </tr>
                ) : (
                  appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-black text-slate-900 text-sm">
                        #{String(apt.tokenNumber).padStart(2, '0')}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{apt.patient.fullName}</div>
                        <div className="text-[11px] text-slate-500">+91 {apt.patient.mobileNumber}</div>
                        <div className="text-[10px] text-slate-400">{apt.patient.bloodGroup || 'Blood: N/A'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{apt.doctor.name}</div>
                        <div className="text-[11px] text-royal-600 font-medium">{apt.department.name}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{apt.appointmentDate}</div>
                        <div className="text-[11px] text-slate-500">{apt.timeSlot}</div>
                      </td>
                      <td className="px-5 py-4">
                        {apt.digitalOp ? (
                          <div className="space-y-1">
                            <span className="font-mono text-[11px] font-bold text-royal-800 bg-royal-50 px-2 py-0.5 rounded border border-royal-200 block w-fit">
                              {apt.digitalOp.opNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDownloadOpSlip(apt.id, apt.digitalOp?.opNumber)}
                              disabled={downloadingSlipId === apt.id}
                              className="flex items-center gap-1 text-[11px] text-royal-600 hover:text-royal-800 hover:underline pt-0.5 font-medium cursor-pointer"
                              title="Download Digital OP Slip PDF"
                            >
                              {downloadingSlipId === apt.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-royal-600" />
                              ) : (
                                <Download className="w-3 h-3 text-royal-600" />
                              )}
                              <span>{downloadingSlipId === apt.id ? 'Downloading...' : 'PDF Slip'}</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">Generating...</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">₹{apt.totalAmount}</div>
                        <div className="text-[10px] text-emerald-600 font-semibold">PAID (Razorpay)</div>
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(apt.status)}</td>
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
                      <td className="px-5 py-4 text-right whitespace-nowrap min-w-[210px]">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {apt.status === 'CONFIRMED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs px-2.5 py-1 text-royal-700 bg-royal-50 border border-royal-200 hover:bg-royal-100 font-bold rounded-lg shadow-2xs"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: apt.id, status: 'WAITING' })
                              }
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1 text-royal-600" /> Mark Arrived
                            </Button>
                          )}

                          {apt.status === 'WAITING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs px-2.5 py-1 text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 font-bold rounded-lg shadow-2xs"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: apt.id, status: 'IN_CONSULTATION' })
                              }
                            >
                              <Stethoscope className="w-3.5 h-3.5 mr-1 text-purple-600" /> In Consultation
                            </Button>
                          )}

                          {apt.status === 'IN_CONSULTATION' && (
                            <Button
                              variant="success"
                              size="sm"
                              className="text-xs px-2.5 py-1 font-bold rounded-lg shadow-2xs"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: apt.id, status: 'COMPLETED' })
                              }
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Complete
                            </Button>
                          )}

                          {apt.status !== 'COMPLETED' && apt.status !== 'CANCELLED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 hover:border-rose-400 px-2.5 py-1 rounded-lg shadow-2xs"
                              onClick={() => {
                                if (window.confirm(`Cancel appointment #${apt.tokenNumber} for ${apt.patient.fullName}?`)) {
                                  updateStatusMutation.mutate({ id: apt.id, status: 'CANCELLED' });
                                }
                              }}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" /> Cancel
                            </Button>
                          )}

                          {apt.status === 'COMPLETED' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Completed
                            </span>
                          )}

                          {apt.status === 'CANCELLED' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" /> Cancelled
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: DOCTORS MANAGEMENT */}
      {activeTab === 'doctors' && (() => {
        const pendingDoctors = (doctors || []).filter((d) => d.status === 'PENDING');
        const filteredDoctors = (doctors || []).filter((d) => {
          const matchesStatus =
            doctorFilterStatus === 'ALL'
              ? true
              : doctorFilterStatus === 'ACTIVE'
              ? d.status === 'ACTIVE' || (!d.status && d.isActive)
              : doctorFilterStatus === 'PENDING'
              ? d.status === 'PENDING'
              : doctorFilterStatus === 'SUSPENDED'
              ? d.status === 'SUSPENDED' || (!d.isActive && d.status !== 'PENDING')
              : true;

          const matchesSearch =
            !doctorSearch.trim() ||
            d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
            d.specialization.toLowerCase().includes(doctorSearch.toLowerCase()) ||
            (d.department?.name && d.department.name.toLowerCase().includes(doctorSearch.toLowerCase()));

          return matchesStatus && matchesSearch;
        });

        return (
          <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
            {/* Top Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Hospital Doctors & Clinical Roster</h2>
                <p className="text-xs text-slate-500">
                  Manage medical staff approvals, credentials, consultation fees, and appointment availability
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsBulkImportOpen(true);
                    setBulkPreviewResult(null);
                    setCsvData('');
                  }}
                  className="text-xs border-royal-200 text-royal-700 hover:bg-royal-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Bulk Import (CSV)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddDeptOpen(true)}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Department
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsAddDoctorOpen(true)}
                  className="bg-royal-600 hover:bg-royal-700 text-xs font-bold"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add Doctor
                </Button>
              </div>
            </div>

            {/* PENDING APPROVAL QUEUE BANNER */}
            {pendingDoctors.length > 0 && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-amber-900 text-sm">Doctor Credential Verification Queue</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                          {pendingDoctors.length} Action Needed
                        </span>
                      </div>
                      <p className="text-xs text-amber-800/80">
                        Review credentials, qualifications, and consultation rates before activating doctor appointments.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingDoctors.map((pDoc) => (
                    <div key={pDoc.id} className="bg-white border border-amber-200/90 rounded-xl p-4 space-y-3 shadow-xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{pDoc.name}</h4>
                          <p className="text-xs font-semibold text-royal-600">{pDoc.specialization}</p>
                          <p className="text-[11px] text-slate-500">
                            {pDoc.department?.name || 'Department'} • {pDoc.qualification}
                          </p>
                        </div>
                        <Badge variant="warning" className="text-[10px]">PENDING</Badge>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Consultation Fee:</span>
                          <span className="font-bold text-slate-800">₹{pDoc.consultationFee}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Experience:</span>
                          <span className="font-medium text-slate-800">{pDoc.experienceYears} Years</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Roster Days:</span>
                          <span className="font-medium text-slate-800 truncate max-w-[140px]">{pDoc.workingDays}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5"
                          disabled={approveDoctorMutation.isPending}
                          onClick={() => approveDoctorMutation.mutate(pDoc.id)}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 hover:border-rose-400 py-1.5 shadow-2xs"
                          onClick={() => {
                            setRejectingDoctor(pDoc);
                            setDoctorRejectReason('');
                          }}
                        >
                          <X className="w-3.5 h-3.5 mr-1 text-rose-600" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter and Search Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Filter:</span>
                {(['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED'] as const).map((st) => {
                  const count =
                    st === 'ALL'
                      ? (doctors || []).length
                      : st === 'ACTIVE'
                      ? (doctors || []).filter((d) => d.status === 'ACTIVE' || (!d.status && d.isActive)).length
                      : st === 'PENDING'
                      ? pendingDoctors.length
                      : (doctors || []).filter((d) => d.status === 'SUSPENDED' || (!d.isActive && d.status !== 'PENDING')).length;

                  return (
                    <button
                      key={st}
                      onClick={() => setDoctorFilterStatus(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        doctorFilterStatus === st
                          ? 'bg-royal-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st === 'ALL' ? 'All Doctors' : st} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search doctor or specialty..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-royal-500"
                />
              </div>
            </div>

            {/* DOCTORS GRID */}
            {filteredDoctors.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Users className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No doctors match your filter</p>
                <p className="text-xs text-slate-400">Try changing status filter or search keywords</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDoctors.map((doc) => {
                  const docStatus = doc.status || (doc.isActive ? 'ACTIVE' : 'SUSPENDED');

                  return (
                    <div
                      key={doc.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">{doc.name}</h3>
                            <div className="text-xs text-royal-600 font-semibold">{doc.specialization}</div>
                            <div className="text-[11px] text-slate-500">{doc.department?.name || 'General Department'}</div>
                          </div>
                          {getDoctorStatusBadge(doc)}
                        </div>

                        <div className="text-xs text-slate-600 space-y-1 pt-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Consultation Fee:</span>
                            <span className="font-bold text-slate-900">₹{doc.consultationFee}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Working Days:</span>
                            <span className="font-medium text-slate-800 truncate max-w-[140px]">
                              {doc.workingDays}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Hours:</span>
                            <span className="font-medium text-slate-800">
                              {doc.workingHoursStart} - {doc.workingHoursEnd}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Experience:</span>
                            <span className="font-medium text-slate-800">
                              {doc.experienceYears} Years
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => setEditingDoctor(doc)}
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Doctor & Fee
                        </Button>

                        <div className="flex items-center gap-2">
                          {docStatus === 'PENDING' ? (
                            <>
                              <Button
                                size="sm"
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                disabled={approveDoctorMutation.isPending}
                                onClick={() => approveDoctorMutation.mutate(doc.id)}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 hover:border-rose-400 shadow-2xs"
                                onClick={() => {
                                  setRejectingDoctor(doc);
                                  setDoctorRejectReason('');
                                }}
                              >
                                <X className="w-3.5 h-3.5 mr-1 text-rose-600" /> Reject
                              </Button>
                            </>
                          ) : docStatus === 'ACTIVE' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                              disabled={toggleDoctorStatusMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`Suspend ${doc.name}? They will not be bookable by patients.`)) {
                                  toggleDoctorStatusMutation.mutate(doc.id);
                                }
                              }}
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" /> Suspend Doctor
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              disabled={toggleDoctorStatusMutation.isPending}
                              onClick={() => toggleDoctorStatusMutation.mutate(doc.id)}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Reactivate Doctor
                            </Button>
                          )}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 hover:border-rose-400 shadow-2xs"
                          onClick={() => setDoctorToDelete(doc)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" /> Delete Doctor
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })()}

      {/* TAB 3: SYSTEM NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-pink-500" />
                Live Automated System Notifications
              </h2>
              <p className="text-xs text-slate-500">
                Triggered automatically upon verified online payment completion
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchNotifications()}>
              Refresh Feed
            </Button>
          </div>

          <div className="space-y-3">
            {(notifications || []).map((notif) => (
              <div
                key={notif.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-royal-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-royal-600" />
                    {notif.title}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(notif.createdAt).toLocaleTimeString()} IST
                  </span>
                </div>
                <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-100 leading-relaxed">
                  {notif.message}
                </pre>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 4: HOSPITAL PATIENT RECORDS & MRN DIRECTORY */}
      {activeTab === 'patients' && canViewPatients && (
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-royal-600" />
                Hospital-Scoped Patient Medical Records
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Search patients by MRN / Patient ID Number, mobile number, or full legal name
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search MRN, Name, or Mobile..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                />
              </div>

              {/* EXPORT PATIENTS TO EXCEL BUTTON */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPatientsExcel}
                disabled={isExportingPatientsExcel}
                className="border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 font-bold text-xs flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
                title="Export patient records to Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                {isExportingPatientsExcel ? 'Exporting...' : 'Export Patients (.xlsx)'}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Patient MRN / ID</th>
                  <th className="px-5 py-3">Full Legal Name</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Age / Gender</th>
                  <th className="px-5 py-3">Blood Group</th>
                  <th className="px-5 py-3">Registered Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {patientsLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Loading hospital patient records...
                    </td>
                  </tr>
                ) : (patients || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No patient records found in this hospital's registry.
                    </td>
                  </tr>
                ) : (
                  (patients || []).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-mono font-bold text-royal-700">
                        {p.patientIdNumber || 'MRN-PENDING'}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {p.fullName}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-600">
                        {p.mobileNumber}
                        {p.email && <div className="text-[11px] text-slate-400">{p.email}</div>}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.age ? `${p.age} Yrs` : '--'} • {p.gender || '--'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px]">
                          {p.bloodGroup || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-royal-600 hover:bg-royal-50 border-royal-200 text-xs font-semibold"
                          onClick={() => setSelectedPatientId(p.id)}
                        >
                          <FileHeart className="w-3.5 h-3.5 mr-1" /> View Clinical Record
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 5: SUPPORT STAFF & TRIAGE SCREENING MANAGEMENT */}
      {activeTab === 'staff' && canManageStaff && (
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" />
                Clinical Support & Triage Nursing Staff
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify and activate registered hospital nursing and triage staff authorized to record patient vitals
              </p>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name or role..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Staff Name</th>
                  <th className="px-5 py-3">Role / Designation</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {staffLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Loading support staff registry...
                    </td>
                  </tr>
                ) : (supportStaffList || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <Stethoscope className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No support staff accounts registered under this hospital yet.
                    </td>
                  </tr>
                ) : (
                  (supportStaffList || []).map((staff: any) => (
                    <tr key={staff.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {staff.user?.name || staff.name || 'Staff Member'}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-700">
                        {staff.roleTitle || 'Triage Nurse'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {staff.department || 'Outpatient Department (OPD)'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-slate-700">{staff.user?.email || staff.email}</div>
                        <div className="text-[11px] text-slate-400">{staff.phone}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={staff.status === 'ACTIVE' ? 'success' : staff.status === 'PENDING' ? 'warning' : 'danger'}
                          className="text-[10px]"
                        >
                          {staff.status || 'ACTIVE'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {staff.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                              onClick={() => approveStaffMutation.mutate(staff.id)}
                              isLoading={approveStaffMutation.isPending}
                            >
                              <Check className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 hover:border-rose-400 shadow-2xs"
                              onClick={() => rejectStaffMutation.mutate(staff.id)}
                            >
                              <X className="w-3.5 h-3.5 mr-1 text-rose-600" /> Reject
                            </Button>
                          </>
                        )}
                        {staff.status === 'ACTIVE' && (
                          <span className="text-[11px] text-emerald-600 font-bold">Verified & Active</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 6: HOSPITAL SUB-ADMINISTRATORS & GRANULAR RBAC */}
      {activeTab === 'subadmins' && canManageSubAdmins && (
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600" />
                Hospital Sub-Administrators & Granular Privileges
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Delegate operational duties (OP management, doctor rosters, patient records) with scoped permissions
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => setIsCreateSubAdminOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Create Sub-Administrator
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Administrator</th>
                  <th className="px-5 py-3">Official Email</th>
                  <th className="px-5 py-3">Role Designation</th>
                  <th className="px-5 py-3">Granted Permissions</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {subAdminsLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Loading sub-administrators...
                    </td>
                  </tr>
                ) : (subAdminsList || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No sub-administrators provisioned for this hospital yet.
                    </td>
                  </tr>
                ) : (
                  (subAdminsList || []).map((sub: any) => {
                    const parsedPerms: string[] = Array.isArray(sub.permissions)
                      ? sub.permissions
                      : JSON.parse(sub.permissions || '[]');

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/80">
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          {sub.user?.name || sub.name}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-600">
                          {sub.user?.email || sub.email}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-700">
                          {sub.roleTitle || 'Sub-Admin'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {parsedPerms.map((perm) => (
                              <span
                                key={perm}
                                className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]"
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            onClick={() => {
                              setEditingSubAdmin(sub);
                              setSubAdminPermissionsState(parsedPerms);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Permissions
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
      )}

      {/* TAB 7: HOSPITAL DIAGNOSTIC LABORATORIES (Requirement 6 & Group 1) */}
      {activeTab === 'labs' && canManageLabs && (
        <Card className="rounded-2xl border-slate-200 shadow-sm space-y-4">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-purple-600" />
                Hospital Associated Diagnostic Laboratories & Requisitions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage in-house and partner pathology laboratories, review doctor lab requisitions by date, and configure private vs public booking visibility
              </p>
            </div>

            {/* Sub-tab view mode switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setLabViewMode('catalog')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  labViewMode === 'catalog'
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Lab Directory ({(hospitalLabs || []).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setLabViewMode('requests')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  labViewMode === 'requests'
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Doctor Requisitions (by Date)</span>
              </button>
            </div>
          </div>

          {labViewMode === 'catalog' ? (
            <>
              <div className="px-5 pt-1 pb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Filter Chips */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
                    <button
                      type="button"
                      onClick={() => setLabFilterStatus('ALL')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        labFilterStatus === 'ALL'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({(hospitalLabs || []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabFilterStatus('PENDING')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        labFilterStatus === 'PENDING'
                          ? 'bg-white text-amber-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pending ({(hospitalLabs || []).filter((l: any) => l.status === 'PENDING').length})
                      {(hospitalLabs || []).filter((l: any) => l.status === 'PENDING').length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabFilterStatus('APPROVED')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        labFilterStatus === 'APPROVED'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Approved ({(hospitalLabs || []).filter((l: any) => l.status === 'APPROVED' || l.status === 'ACTIVE').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabFilterStatus('REJECTED')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        labFilterStatus === 'REJECTED'
                          ? 'bg-white text-rose-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Rejected ({(hospitalLabs || []).filter((l: any) => l.status === 'REJECTED').length})
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search labs by name, city, phone..."
                      value={labSearch}
                      onChange={(e) => setLabSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 w-52 sm:w-64"
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLabs()}
                  className="text-xs shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Laboratory Details</th>
                      <th className="px-5 py-3">Contact & Staff</th>
                      <th className="px-5 py-3">Affiliation / Status</th>
                      <th className="px-5 py-3">Visibility Mode</th>
                      <th className="px-5 py-3">Tests & Volume</th>
                      <th className="px-5 py-3 text-right whitespace-nowrap min-w-[200px]">Approval & Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {labsLoading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-400">
                          Loading hospital diagnostic laboratories...
                        </td>
                      </tr>
                    ) : (hospitalLabs || []).filter((l: any) => {
                        if (labFilterStatus === 'PENDING' && l.status !== 'PENDING') return false;
                        if (labFilterStatus === 'APPROVED' && l.status !== 'APPROVED' && l.status !== 'ACTIVE') return false;
                        if (labFilterStatus === 'REJECTED' && l.status !== 'REJECTED') return false;
                        if (!labSearch.trim()) return true;
                        const q = labSearch.toLowerCase();
                        return (
                          l.name?.toLowerCase().includes(q) ||
                          l.city?.toLowerCase().includes(q) ||
                          l.phone?.includes(q) ||
                          l.email?.toLowerCase().includes(q)
                        );
                      }).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          {labFilterStatus === 'PENDING'
                            ? 'No pending laboratory applications awaiting hospital admin approval.'
                            : 'No diagnostic laboratories found matching your criteria.'}
                        </td>
                      </tr>
                    ) : (
                      (hospitalLabs || [])
                        .filter((l: any) => {
                          if (labFilterStatus === 'PENDING' && l.status !== 'PENDING') return false;
                          if (labFilterStatus === 'APPROVED' && l.status !== 'APPROVED' && l.status !== 'ACTIVE') return false;
                          if (labFilterStatus === 'REJECTED' && l.status !== 'REJECTED') return false;
                          if (!labSearch.trim()) return true;
                          const q = labSearch.toLowerCase();
                          return (
                            l.name?.toLowerCase().includes(q) ||
                            l.city?.toLowerCase().includes(q) ||
                            l.phone?.includes(q) ||
                            l.email?.toLowerCase().includes(q)
                          );
                        })
                        .map((lab: any) => {
                          const isPublic = (lab.visibility || 'PUBLIC') === 'PUBLIC';
                          const isPending = lab.status === 'PENDING';
                          const isApproved = lab.status === 'APPROVED' || lab.status === 'ACTIVE';
                          const isRejected = lab.status === 'REJECTED';
                          const primaryTech = (lab.technicians || [])[0];

                          return (
                            <tr key={lab.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-5 py-4">
                                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                  {lab.name}
                                  {isPublic ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      <Globe className="w-3.5 h-3.5 text-emerald-600" /> Public Lab
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                      <Lock className="w-3.5 h-3.5 text-amber-600" /> In-Hospital Only
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  ID: <span className="font-mono">{lab.id.slice(0, 8)}</span> • License: <span className="font-mono">{lab.licenseNumber || 'Under Review'}</span>
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <div className="font-semibold text-slate-800">{lab.phone}</div>
                                <div className="text-slate-500 font-mono text-[11px]">{lab.email}</div>
                                <div className="text-slate-400 text-[11px] truncate max-w-xs">
                                  {lab.address ? `${lab.address}, ${lab.city}` : lab.city || 'Hospital Campus'}
                                </div>
                                {primaryTech && (
                                  <div className="mt-1 text-[10px] text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                    Tech: {primaryTech.user?.name || primaryTech.qualification || 'Certified Technician'}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-4">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-full">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Hospital Approval
                                  </span>
                                ) : isApproved ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-full">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved & Active
                                  </span>
                                ) : isRejected ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-full">
                                    <X className="w-3.5 h-3.5 text-rose-600" /> Rejected
                                  </span>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">
                                    {lab.status || 'ACTIVE'}
                                  </Badge>
                                )}
                              </td>

                              <td className="px-5 py-4">
                                {isPublic ? (
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                                      <Globe className="w-3.5 h-3.5 text-emerald-600" /> Public Catalog
                                    </span>
                                    <p className="text-[10px] text-slate-500 leading-tight">
                                      Listed on patient portal for direct test bookings
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-amber-700 flex items-center gap-1">
                                      <Lock className="w-3.5 h-3.5 text-amber-600" /> Private Lab
                                    </span>
                                    <p className="text-[10px] text-slate-500 leading-tight">
                                      Restricted to in-hospital doctor clinical requisitions
                                    </p>
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-4">
                                <div className="font-bold text-purple-900">
                                  {lab._count?.tests || (lab.tests || []).length} Tests Listed
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {lab._count?.requests || 0} Requisitions Processed
                                </div>
                              </td>

                              <td className="px-5 py-4 text-right">
                                <div className="inline-flex items-center gap-2 justify-end flex-wrap">
                                  {/* Lab Approval Actions */}
                                  {isPending && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => approveHospitalLabMutation.mutate(lab.id)}
                                        isLoading={approveHospitalLabMutation.isPending}
                                        className="text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs whitespace-nowrap"
                                        title="Approve this laboratory for hospital operations"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Approve Lab
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRejectingLab(lab)}
                                        className="text-xs font-bold text-rose-800 bg-rose-50 border-rose-300 hover:bg-rose-100 hover:border-rose-400 shadow-2xs whitespace-nowrap"
                                        title="Reject laboratory registration application"
                                      >
                                        <X className="w-3.5 h-3.5 mr-1 text-rose-600" /> Reject Lab
                                      </Button>
                                    </>
                                  )}

                                  {isRejected && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => approveHospitalLabMutation.mutate(lab.id)}
                                      isLoading={approveHospitalLabMutation.isPending}
                                      className="text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs whitespace-nowrap"
                                      title="Re-approve laboratory"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Re-Approve
                                    </Button>
                                  )}

                                  {/* Visibility Toggle Button */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateLabVisibilityMutation.mutate({
                                        labId: lab.id,
                                        visibility: isPublic ? 'PRIVATE' : 'PUBLIC',
                                      })
                                    }
                                    isLoading={updateLabVisibilityMutation.isPending}
                                    className={`text-xs font-bold ${
                                      isPublic
                                        ? 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'
                                        : 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                                    }`}
                                    title={
                                      isPublic
                                        ? 'Make this lab private so only hospital doctors can order tests'
                                        : 'Make this lab public so patients can book tests directly'
                                    }
                                  >
                                    {isPublic ? (
                                      <>
                                        <Lock className="w-3.5 h-3.5 mr-1 text-amber-600" /> Make Private
                                      </>
                                    ) : (
                                      <>
                                        <Globe className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Make Public
                                      </>
                                    )}
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs font-bold text-purple-800 bg-purple-50 border-purple-300 hover:bg-purple-100"
                                    onClick={() => setEditingLab(lab)}
                                  >
                                    <Edit2 className="w-3.5 h-3.5 mr-1 text-purple-600" /> Edit Profile
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs font-bold text-rose-800 bg-rose-50 border-rose-300 hover:bg-rose-100"
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to delete laboratory "${lab.name}"? This action cannot be undone.`)) {
                                        deleteLabMutation.mutate(lab.id);
                                      }
                                    }}
                                    isLoading={deleteLabMutation.isPending}
                                    title="Delete laboratory record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" /> Delete
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* DOCTOR LAB REQUISITIONS (ORGANIZED BY DATE) */
            <>
              <div className="px-5 pt-1 pb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-semibold">Filter by Date:</span>
                  <input
                    type="date"
                    value={labRequestDate}
                    onChange={(e) => setLabRequestDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-medium"
                  />
                  {labRequestDate ? (
                    <button
                      type="button"
                      onClick={() => setLabRequestDate('')}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded"
                    >
                      Clear
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLabRequestDate(new Date().toISOString().split('T')[0])}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 border border-purple-200 px-2 py-1 rounded"
                    >
                      Today
                    </button>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchAdminLabRequests()}
                  className="text-xs shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh Requisitions
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Requisition #</th>
                      <th className="px-5 py-3">Requested Date</th>
                      <th className="px-5 py-3">Clinician / Doctor</th>
                      <th className="px-5 py-3">Patient Details</th>
                      <th className="px-5 py-3">Target Laboratory</th>
                      <th className="px-5 py-3">Tests Ordered</th>
                      <th className="px-5 py-3">Priority</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Findings / Results</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {adminLabRequestsLoading ? (
                      <tr>
                        <td colSpan={9} className="text-center py-10 text-slate-400">
                          Loading laboratory requisitions...
                        </td>
                      </tr>
                    ) : (adminLabRequests || []).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400">
                          <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          No diagnostic laboratory requisitions found for the selected date criteria.
                        </td>
                      </tr>
                    ) : (
                      (adminLabRequests || []).map((req: any) => {
                        const parsedTests = typeof req.tests === 'string' ? JSON.parse(req.tests || '[]') : req.tests || [];
                        const reqDate = req.createdAt ? new Date(req.createdAt).toLocaleDateString() : (req.preferredDate || '—');
                        const reqTime = req.createdAt ? new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        return (
                          <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-4 font-mono font-bold text-purple-700">
                              {req.requestNumber}
                            </td>
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900">{reqDate}</div>
                              {reqTime && <div className="text-[10px] text-slate-400">{reqTime}</div>}
                            </td>
                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-900">{req.doctor?.name ? `Dr. ${req.doctor.name}` : 'Hospital Doctor'}</div>
                              <div className="text-[11px] text-royal-600">{req.doctor?.specialization || 'Clinical OP'}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-900">{req.patient?.fullName}</div>
                              <div className="text-[11px] text-slate-500">+91 {req.patient?.mobileNumber}</div>
                              <div className="text-[10px] text-slate-400 font-mono">MRN: {req.patient?.patientIdNumber || 'N/A'}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900">{req.lab?.name || 'General Pathology Lab'}</div>
                              <div className="text-[10px] text-slate-500">{req.lab?.phone}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="space-y-0.5">
                                {parsedTests.map((t: any, idx: number) => (
                                  <div key={idx} className="font-medium text-slate-800">
                                    • {t.name}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <Badge variant={req.priority === 'URGENT' ? 'danger' : 'outline'} className="text-[10px]">
                                {req.priority}
                              </Badge>
                            </td>
                            <td className="px-5 py-4">
                              <Badge
                                variant={
                                  req.status === 'COMPLETED'
                                    ? 'success'
                                    : req.status === 'PROCESSING'
                                    ? 'purple'
                                    : req.status === 'CANCELLED'
                                    ? 'danger'
                                    : 'warning'
                                }
                                className="text-[10px]"
                              >
                                {req.status}
                              </Badge>
                            </td>
                            <td className="px-5 py-4">
                              {req.report ? (
                                <div className="space-y-1">
                                  <div className="font-bold text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Report Ready
                                  </div>
                                  <div className="text-[11px] text-slate-600 truncate max-w-xs">
                                    {req.report.results}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Awaiting specimen analysis</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* TAB 8: HOSPITAL PHARMACIES & DISPENSING MANAGEMENT */}
      {activeTab === 'pharmacies' && canManagePharmacies && (
        <Card className="rounded-2xl border-slate-200 shadow-sm space-y-4">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pill className="w-5 h-5 text-emerald-600" />
                Hospital Pharmacies & Dispensing Outlets
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and approve hospital pharmacy registration requests, manage drug licenses, and oversee prescription fulfillment
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter Chips */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
                <button
                  type="button"
                  onClick={() => setPharmacyFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    pharmacyFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({(hospitalPharmacies || []).length})
                </button>
                <button
                  type="button"
                  onClick={() => setPharmacyFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    pharmacyFilter === 'PENDING'
                      ? 'bg-white text-amber-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pending ({(hospitalPharmacies || []).filter((p: any) => p.status === 'PENDING').length})
                  {(hospitalPharmacies || []).filter((p: any) => p.status === 'PENDING').length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPharmacyFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    pharmacyFilter === 'ACTIVE'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active ({(hospitalPharmacies || []).filter((p: any) => p.status === 'ACTIVE').length})
                </button>
                <button
                  type="button"
                  onClick={() => setPharmacyFilter('REJECTED')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    pharmacyFilter === 'REJECTED'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rejected ({(hospitalPharmacies || []).filter((p: any) => p.status === 'REJECTED').length})
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchPharmacies()}
                className="text-xs shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-5 pt-1 pb-3 flex items-center justify-between gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search pharmacy name, license, pharmacist, phone..."
                value={pharmacySearch}
                onChange={(e) => setPharmacySearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-64 sm:w-80"
              />
            </div>
            {pharmacySearch && (
              <button
                type="button"
                onClick={() => setPharmacySearch('')}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Clear Search
              </button>
            )}
            <div className="text-[11px] text-slate-400 font-medium">
              {(hospitalPharmacies || []).length} registered hospital pharmacies
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Pharmacy Name & Outlet</th>
                  <th className="px-5 py-3.5">Drug License Number</th>
                  <th className="px-5 py-3.5">In-Charge Pharmacist & Staff</th>
                  <th className="px-5 py-3.5">Contact Details</th>
                  <th className="px-5 py-3.5">Prescriptions Dispensed</th>
                  <th className="px-5 py-3.5">Approval Status</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap min-w-[200px]">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pharmaciesLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      Loading hospital pharmacies...
                    </td>
                  </tr>
                ) : (hospitalPharmacies || []).filter((p: any) => {
                    if (pharmacyFilter !== 'ALL' && p.status !== pharmacyFilter) return false;
                    if (!pharmacySearch.trim()) return true;
                    const q = pharmacySearch.toLowerCase();
                    const primaryStaff = (p.staff || [])[0];
                    return (
                      p.name?.toLowerCase().includes(q) ||
                      p.licenseNumber?.toLowerCase().includes(q) ||
                      p.phone?.includes(q) ||
                      p.email?.toLowerCase().includes(q) ||
                      primaryStaff?.user?.name?.toLowerCase().includes(q) ||
                      primaryStaff?.user?.email?.toLowerCase().includes(q)
                    );
                  }).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      {pharmacySearch
                        ? `No pharmacies matching "${pharmacySearch}"`
                        : pharmacyFilter === 'PENDING'
                        ? 'No pending pharmacy registration requests awaiting hospital admin approval.'
                        : 'No pharmacies registered for this hospital.'}
                    </td>
                  </tr>
                ) : (
                  (hospitalPharmacies || [])
                    .filter((p: any) => {
                      if (pharmacyFilter !== 'ALL' && p.status !== pharmacyFilter) return false;
                      if (!pharmacySearch.trim()) return true;
                      const q = pharmacySearch.toLowerCase();
                      const primaryStaff = (p.staff || [])[0];
                      return (
                        p.name?.toLowerCase().includes(q) ||
                        p.licenseNumber?.toLowerCase().includes(q) ||
                        p.phone?.includes(q) ||
                        p.email?.toLowerCase().includes(q) ||
                        primaryStaff?.user?.name?.toLowerCase().includes(q) ||
                        primaryStaff?.user?.email?.toLowerCase().includes(q)
                      );
                    })
                    .map((pharmacy: any) => {
                      const isPending = pharmacy.status === 'PENDING';
                      const isActive = pharmacy.status === 'ACTIVE';
                      const isRejected = pharmacy.status === 'REJECTED';
                      const isSuspended = pharmacy.status === 'SUSPENDED';
                      const primaryStaff = (pharmacy.staff || [])[0];

                      return (
                        <tr key={pharmacy.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                              {pharmacy.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              ID: <span className="font-mono">{pharmacy.id.slice(0, 8)}</span> • Joined: {new Date(pharmacy.createdAt).toLocaleDateString()}
                            </div>
                            {pharmacy.address && (
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">
                                {pharmacy.address}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4 font-mono font-bold text-emerald-800 text-xs">
                            {pharmacy.licenseNumber || 'Under Verification'}
                          </td>

                          <td className="px-5 py-4">
                            {primaryStaff ? (
                              <div>
                                <div className="font-bold text-slate-900">
                                  {primaryStaff.user?.name || 'Registered Pharmacist'}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {primaryStaff.user?.email}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {primaryStaff.role || 'CHIEF_PHARMACIST'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No staff profile</span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-800">{pharmacy.phone || '--'}</div>
                            <div className="text-slate-500 font-mono text-[11px]">{pharmacy.email || '--'}</div>
                          </td>

                          <td className="px-5 py-4 font-bold text-slate-900">
                            {pharmacy._count?.prescriptions || (pharmacy.prescriptions || []).length || 0} Prescriptions
                          </td>

                          <td className="px-5 py-4">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-full">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                Pending Approval
                              </span>
                            ) : isActive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Active & Dispensing
                              </span>
                            ) : isRejected ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-full">
                                <X className="w-3.5 h-3.5 text-rose-600" />
                                Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-full">
                                <Ban className="w-3.5 h-3.5 text-slate-600" />
                                {pharmacy.status}
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex items-center gap-2 justify-end flex-wrap">
                              {isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => approvePharmacyMutation.mutate(pharmacy.id)}
                                    isLoading={approvePharmacyMutation.isPending}
                                    className="text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs whitespace-nowrap"
                                    title="Approve this pharmacy registration for your hospital"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRejectingPharmacy(pharmacy)}
                                    className="text-xs font-bold text-rose-800 bg-rose-50 border-rose-300 hover:bg-rose-100 hover:border-rose-400 shadow-2xs whitespace-nowrap"
                                    title="Reject pharmacy registration application"
                                  >
                                    <X className="w-3.5 h-3.5 mr-1 text-rose-600" /> Reject
                                  </Button>
                                </>
                              )}

                              {isActive && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => togglePharmacyStatusMutation.mutate(pharmacy.id)}
                                  isLoading={togglePharmacyStatusMutation.isPending}
                                  className="text-xs font-bold text-amber-800 bg-amber-50 border-amber-300 hover:bg-amber-100 hover:border-amber-400 shadow-2xs"
                                  title="Suspend pharmacy operations"
                                >
                                  <Ban className="w-3.5 h-3.5 mr-1 text-amber-600" /> Suspend
                                </Button>
                              )}

                              {isSuspended && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => togglePharmacyStatusMutation.mutate(pharmacy.id)}
                                  isLoading={togglePharmacyStatusMutation.isPending}
                                  className="text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs"
                                  title="Reactivate suspended pharmacy"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Reactivate
                                </Button>
                              )}

                              {isRejected && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approvePharmacyMutation.mutate(pharmacy.id)}
                                  isLoading={approvePharmacyMutation.isPending}
                                  className="text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs"
                                  title="Re-approve pharmacy registration"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Re-Approve
                                </Button>
                              )}
                            </div>
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

      {/* EDIT HOSPITAL LAB MODAL */}
      {editingLab && (
        <Modal
          isOpen={!!editingLab}
          onClose={() => setEditingLab(null)}
          title={`Edit Laboratory Profile - ${editingLab.name}`}
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const name = (form.elements.namedItem('labName') as HTMLInputElement).value;
              const phone = (form.elements.namedItem('labPhone') as HTMLInputElement).value;
              const email = (form.elements.namedItem('labEmail') as HTMLInputElement).value;
              const address = (form.elements.namedItem('labAddress') as HTMLInputElement).value;
              const city = (form.elements.namedItem('labCity') as HTMLInputElement).value;

              updateLabMutation.mutate({
                labId: editingLab.id,
                data: {
                  name: name.trim(),
                  phone: phone.trim(),
                  email: email.trim(),
                  address: address.trim(),
                  city: city.trim(),
                },
              });
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Laboratory Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="labName"
                defaultValue={editingLab.name}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="labPhone"
                  defaultValue={editingLab.phone}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  name="labEmail"
                  defaultValue={editingLab.email}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City / Location</label>
                <input
                  type="text"
                  name="labCity"
                  defaultValue={editingLab.city || ''}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address / Block</label>
                <input
                  type="text"
                  name="labAddress"
                  defaultValue={editingLab.address || ''}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingLab(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                isLoading={updateLabMutation.isPending}
              >
                Save Laboratory Profile
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT DOCTOR MODAL */}
      {editingDoctor && (
        <Modal
          isOpen={!!editingDoctor}
          onClose={() => setEditingDoctor(null)}
          title={`Edit ${editingDoctor.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Consultation Fee (₹)</label>
              <input
                type="number"
                defaultValue={editingDoctor.consultationFee}
                id="editFee"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Working Days</label>
              <input
                type="text"
                defaultValue={editingDoctor.workingDays}
                id="editDays"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                <input
                  type="text"
                  defaultValue={editingDoctor.workingHoursStart}
                  id="editStart"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">End Time</label>
                <input
                  type="text"
                  defaultValue={editingDoctor.workingHoursEnd}
                  id="editEnd"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                defaultChecked={editingDoctor.isActive}
                id="editActive"
                className="w-4 h-4 text-royal-600 rounded"
              />
              <label htmlFor="editActive" className="font-semibold text-slate-700">
                Doctor is Active for Booking
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setEditingDoctor(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const fee = (document.getElementById('editFee') as HTMLInputElement).value;
                  const days = (document.getElementById('editDays') as HTMLInputElement).value;
                  const start = (document.getElementById('editStart') as HTMLInputElement).value;
                  const end = (document.getElementById('editEnd') as HTMLInputElement).value;
                  const active = (document.getElementById('editActive') as HTMLInputElement).checked;

                  updateDoctorMutation.mutate({
                    id: editingDoctor.id,
                    data: {
                      consultationFee: Number(fee),
                      workingDays: days,
                      workingHoursStart: start,
                      workingHoursEnd: end,
                      isActive: active,
                    },
                  });
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE DOCTOR CONFIRMATION MODAL */}
      {doctorToDelete && (
        <Modal
          isOpen={!!doctorToDelete}
          onClose={() => !deleteDoctorMutation.isPending && setDoctorToDelete(null)}
          title={`Delete Doctor - Dr. ${doctorToDelete.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-black text-rose-800 text-sm">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                Permanent Deletion / Deactivation Warning
              </div>
              <p className="text-rose-700 text-xs leading-relaxed">
                Are you sure you want to delete <strong>Dr. {doctorToDelete.name}</strong> from your hospital?
              </p>
              <div className="text-[11px] text-rose-600 space-y-1 bg-white/70 p-2.5 rounded-lg border border-rose-200">
                <div>• Doctor login account will be immediately deactivated and cannot access the portal.</div>
                <div>• All future unbooked appointment slots and working schedules will be disabled.</div>
                <div>• Historical patient consultations, digital OP slips, and prescriptions are preserved for medical audit and regulatory integrity.</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Doctor Profile Summary</div>
              <div className="font-black text-slate-800 text-sm">Dr. {doctorToDelete.name}</div>
              <div className="text-slate-600 text-xs">
                {doctorToDelete.specialization} • {doctorToDelete.qualification}
              </div>
              <div className="text-slate-500 text-[11px] font-mono">
                Consultation Fee: ₹{doctorToDelete.consultationFee} • Experience: {doctorToDelete.experienceYears} Years
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-slate-700 bg-white border-slate-300 hover:bg-slate-50 font-bold text-xs"
                onClick={() => setDoctorToDelete(null)}
                disabled={deleteDoctorMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                onClick={() => deleteDoctorMutation.mutate(doctorToDelete.id)}
                disabled={deleteDoctorMutation.isPending}
              >
                {deleteDoctorMutation.isPending ? 'Deleting Doctor...' : 'Confirm Delete Doctor'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ADD DOCTOR MODAL */}
      {isAddDoctorOpen && (
        <Modal
          isOpen={isAddDoctorOpen}
          onClose={() => setIsAddDoctorOpen(false)}
          title="Register New Doctor"
          maxWidth="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newDocData.name || !newDocData.departmentId || !newDocData.specialization || !newDocData.qualification) {
                toast.error('Validation Error', 'Please complete all required doctor professional fields.');
                return;
              }
              if (!doctorAccountEmail.trim()) {
                toast.error('Doctor Email Required', 'Please provide the doctor official email address for account access.');
                return;
              }
              if (!doctorAccountPhone.trim()) {
                toast.error('Contact Phone Required', 'Please provide the doctor contact mobile number.');
                return;
              }
              const payload: any = {
                ...newDocData,
                experienceYears: Number(newDocData.experienceYears),
                consultationFee: Number(newDocData.consultationFee),
                about:
                  newDocData.about.trim().length >= 10
                    ? newDocData.about.trim()
                    : `Specialist in ${newDocData.specialization} providing outpatient consultations.`,
                email: doctorAccountEmail.trim(),
                phone: doctorAccountPhone.trim(),
                password: doctorAccountPassword.trim() || undefined,
              };
              addDoctorMutation.mutate(payload);
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Doctor Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDocData.name}
                  onChange={(e) => setNewDocData({ ...newDocData, name: e.target.value })}
                  placeholder="e.g. Dr. Ananya Sen"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-royal-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newDocData.departmentId}
                  onChange={(e) => setNewDocData({ ...newDocData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                  required
                >
                  <option value="">Select Clinical Department...</option>
                  {(departments || []).map((dept: any) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Specialization <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDocData.specialization}
                  onChange={(e) => setNewDocData({ ...newDocData, specialization: e.target.value })}
                  placeholder="e.g. Consultant Interventional Cardiologist"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Qualifications <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDocData.qualification}
                  onChange={(e) => setNewDocData({ ...newDocData, qualification: e.target.value })}
                  placeholder="e.g. MBBS, MD, DM (Cardiology)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Consultation Fee (₹)</label>
                <input
                  type="number"
                  value={newDocData.consultationFee}
                  onChange={(e) => setNewDocData({ ...newDocData, consultationFee: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Experience (Years)</label>
                <input
                  type="number"
                  value={newDocData.experienceYears}
                  onChange={(e) => setNewDocData({ ...newDocData, experienceYears: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Languages</label>
                <input
                  type="text"
                  value={newDocData.languages}
                  onChange={(e) => setNewDocData({ ...newDocData, languages: e.target.value })}
                  placeholder="e.g. English, Hindi, Telugu"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Working Days</label>
                <input
                  type="text"
                  value={newDocData.workingDays}
                  onChange={(e) => setNewDocData({ ...newDocData, workingDays: e.target.value })}
                  placeholder="Mon,Tue,Wed,Thu,Fri,Sat"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hours Start (HH:MM)</label>
                <input
                  type="text"
                  value={newDocData.workingHoursStart}
                  onChange={(e) => setNewDocData({ ...newDocData, workingHoursStart: e.target.value })}
                  placeholder="09:00"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hours End (HH:MM)</label>
                <input
                  type="text"
                  value={newDocData.workingHoursEnd}
                  onChange={(e) => setNewDocData({ ...newDocData, workingHoursEnd: e.target.value })}
                  placeholder="17:00"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">About / Bio</label>
              <textarea
                rows={2}
                value={newDocData.about}
                onChange={(e) => setNewDocData({ ...newDocData, about: e.target.value })}
                placeholder="Brief summary of clinical achievements, subspecialties, and patient care philosophy..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            {/* Doctor Account Login & Direct Access Credentials */}
            <div className="p-4 bg-royal-50/70 rounded-2xl border border-royal-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-royal-950 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-royal-600" />
                  Doctor Account Login & Initial Credentials
                </span>
                <span className="text-[10px] font-semibold text-royal-700 bg-royal-100 px-2 py-0.5 rounded-full">
                  Direct OPD Activation
                </span>
              </div>
              <p className="text-slate-600 text-[11px]">
                An accredited doctor portal account will be created directly under your hospital. Initial login credentials will be displayed immediately upon creation so you can securely share them with the doctor.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Doctor Official Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={doctorAccountEmail}
                    onChange={(e) => setDoctorAccountEmail(e.target.value)}
                    placeholder="doctor.name@hospital.org"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Doctor Contact Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={doctorAccountPhone}
                    onChange={(e) => setDoctorAccountPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Initial Temporary Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setDoctorAccountPassword(`Doc@${Math.floor(100000 + Math.random() * 900000)}`)}
                    className="text-[11px] font-bold text-royal-700 hover:text-royal-900 bg-white border border-royal-200 px-2 py-0.5 rounded-lg shadow-sm"
                  >
                    Auto-Generate Password
                  </button>
                </div>
                <input
                  type="text"
                  value={doctorAccountPassword}
                  onChange={(e) => setDoctorAccountPassword(e.target.value)}
                  placeholder="Min 6 characters (e.g. Doc@849201)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Doctors can change their password at any time in their dedicated Edit Profile section.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddDoctorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-royal-600 hover:bg-royal-700 font-bold" disabled={addDoctorMutation.isPending}>
                {addDoctorMutation.isPending ? 'Registering...' : 'Register Doctor'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* INITIAL CREDENTIALS MODAL AFTER CREATION */}
      {createdDoctorCredentials && (
        <Modal
          isOpen={!!createdDoctorCredentials}
          onClose={() => setCreatedDoctorCredentials(null)}
          title="Doctor Account Created - Initial Login Credentials"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-950">Doctor Successfully Registered!</p>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  The doctor profile and login account have been activated under your hospital. Share these initial credentials with <strong>{createdDoctorCredentials.name}</strong>.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Doctor Login Email
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdDoctorCredentials.email}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs text-slate-800 select-all"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold"
                    onClick={() => {
                      navigator.clipboard.writeText(createdDoctorCredentials.email);
                      toast.success('Email Copied', 'Doctor email copied to clipboard.');
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>

              {createdDoctorCredentials.password && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Initial Temporary Password
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdDoctorCredentials.password}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs font-bold text-royal-700 select-all"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold"
                      onClick={() => {
                        navigator.clipboard.writeText(createdDoctorCredentials.password!);
                        toast.success('Password Copied', 'Initial password copied to clipboard.');
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Security notice:</strong> For doctor privacy, this temporary password will never be displayed in plain text again. Doctor can change it at any time in their Edit Profile settings.
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold"
                onClick={() => {
                  const credText = `RocketWheel MedPulse Doctor Login\nDoctor: ${createdDoctorCredentials.name}\nEmail: ${createdDoctorCredentials.email}\nTemporary Password: ${createdDoctorCredentials.password || 'N/A'}\nStaff Login Portal: ${window.location.origin}/staff/login`;
                  navigator.clipboard.writeText(credText);
                  toast.success('All Credentials Copied', 'Complete login instructions copied to clipboard.');
                }}
              >
                <Copy className="w-3.5 h-3.5 mr-1 text-royal-600" />
                Copy All Credentials
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-royal-600 hover:bg-royal-700 text-white font-bold px-5"
                onClick={() => setCreatedDoctorCredentials(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ADD DEPARTMENT MODAL */}
      {isAddDeptOpen && (
        <Modal
          isOpen={isAddDeptOpen}
          onClose={() => setIsAddDeptOpen(false)}
          title="Add Clinical Department"
          maxWidth="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newDeptName || !newDeptCode) {
                toast.error('Validation Error', 'Department name and code are required.');
                return;
              }
              addDepartmentMutation.mutate({
                name: newDeptName.trim(),
                code: newDeptCode.trim().toUpperCase(),
                description: newDeptDesc.trim() || undefined,
              });
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Department Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="e.g. Oncology / Pulmonology"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Department Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newDeptCode}
                onChange={(e) => setNewDeptCode(e.target.value)}
                placeholder="e.g. ONCO"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono uppercase"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                rows={2}
                value={newDeptDesc}
                onChange={(e) => setNewDeptDesc(e.target.value)}
                placeholder="Description of clinical discipline..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddDeptOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-royal-600 hover:bg-royal-700 font-bold" disabled={addDepartmentMutation.isPending}>
                {addDepartmentMutation.isPending ? 'Saving...' : 'Add Department'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* BULK IMPORT DOCTORS MODAL */}
      {isBulkImportOpen && (
        <Modal
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          title="Bulk Doctor Onboarding (CSV Upload)"
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Paste or edit a comma-separated roster to onboard multiple doctors at once with credential verification and automatic weekly OPD schedules.
            </p>

            {/* Department codes reference */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Hospital Department Codes (Use in 'departmentCode'):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(departments || []).map((d: any) => (
                  <span
                    key={d.id}
                    className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-mono font-bold text-royal-700"
                  >
                    {d.code} <span className="font-normal text-slate-500">({d.name})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* CSV Template Bar */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">CSV Data Format</span>
              <button
                type="button"
                onClick={() => {
                  const c1 = (departments && departments.length > 0) ? departments[0].code : 'CARD';
                  const c2 = (departments && departments.length > 1) ? departments[1].code : c1;
                  const sample = `name,email,specialization,qualification,departmentCode,experienceYears,consultationFee,languages,workingDays,workingHoursStart,workingHoursEnd
Dr. Sunita Rao,sunita.rao@hospital.org,Senior Specialist,MBBS MD DM,${c1},12,800,English Hindi,Mon Tue Wed Thu Fri,09:00,16:00
Dr. Vikram Verma,vikram.verma@hospital.org,Consultant Physician,MBBS MD,${c2},8,600,English Telugu,Mon Tue Wed Thu Fri Sat,10:00,17:00`;
                  setCsvData(sample);
                  setBulkPreviewResult(null);
                }}
                className="text-royal-600 hover:text-royal-800 font-bold underline cursor-pointer"
              >
                Load Sample Template
              </button>
            </div>

            <textarea
              rows={6}
              value={csvData}
              onChange={(e) => {
                setCsvData(e.target.value);
                setBulkPreviewResult(null);
              }}
              placeholder="name,email,specialization,qualification,departmentCode,experienceYears,consultationFee,languages,workingDays,workingHoursStart,workingHoursEnd"
              className="w-full font-mono text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-slate-50/50"
            />

            {/* VALIDATION PREVIEW SUMMARY */}
            {bulkPreviewResult && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">CSV Validation Results</h4>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      Total: {bulkPreviewResult.total}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Valid: {bulkPreviewResult.validCount}
                    </span>
                    {bulkPreviewResult.errorCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        Errors: {bulkPreviewResult.errorCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {bulkPreviewResult.preview.map((p: any) => (
                    <div key={p.row} className="p-3 flex items-start justify-between gap-3 text-xs bg-white">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-400">Row #{p.row}</span>
                          <span className="font-bold text-slate-900">{p.data?.name || 'Unknown'}</span>
                          <span className="text-slate-500 font-mono text-[11px]">&lt;{p.data?.email}&gt;</span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {p.data?.specialization} • Dept: <span className="font-semibold text-royal-700">{p.data?.departmentName || 'N/A'}</span> • Fee: ₹{p.data?.consultationFee}
                        </div>
                        {p.errors && p.errors.length > 0 && (
                          <div className="text-rose-600 text-[11px] space-y-0.5 font-medium pt-1">
                            {p.errors.map((err: string, i: number) => (
                              <div key={i} className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge variant={p.isValid ? 'success' : 'danger'} className="text-[10px] shrink-0">
                        {p.isValid ? 'READY' : 'INVALID'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MODAL ACTION BUTTONS */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsBulkImportOpen(false)}>
                Cancel
              </Button>

              {!bulkPreviewResult ? (
                <Button
                  size="sm"
                  onClick={() => bulkImportMutation.mutate({ commit: false })}
                  disabled={!csvData.trim() || bulkImportMutation.isPending}
                  className="bg-royal-600 hover:bg-royal-700 font-bold"
                >
                  {bulkImportMutation.isPending ? 'Validating...' : 'Validate CSV Rows'}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkPreviewResult(null)}
                  >
                    Edit CSV Text
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => bulkImportMutation.mutate({ commit: true })}
                    disabled={bulkPreviewResult.validCount === 0 || bulkImportMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {bulkImportMutation.isPending
                      ? 'Importing...'
                      : `Confirm & Import ${bulkPreviewResult.validCount} Doctor(s)`}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* REJECT DOCTOR MODAL */}
      {rejectingDoctor && (
        <Modal
          isOpen={!!rejectingDoctor}
          onClose={() => setRejectingDoctor(null)}
          title={`Reject Application: ${rejectingDoctor.name}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Provide an administrative reason for declining this doctor credential registration. The doctor will be set to REJECTED.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for Rejection (Optional)
              </label>
              <textarea
                rows={3}
                value={doctorRejectReason}
                onChange={(e) => setDoctorRejectReason(e.target.value)}
                placeholder="e.g. Incomplete medical council registration, credential verification mismatch..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setRejectingDoctor(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                disabled={rejectDoctorMutation.isPending}
                onClick={() =>
                  rejectDoctorMutation.mutate({
                    doctorId: rejectingDoctor.id,
                    reason: doctorRejectReason.trim() || undefined,
                  })
                }
              >
                {rejectDoctorMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* OFFLINE WALK-IN OP BOOKING MODAL */}
      {isOfflineBookingOpen && (
        <Modal
          isOpen={isOfflineBookingOpen}
          onClose={() => {
            setIsOfflineBookingOpen(false);
            setCreatedOfflineBooking(null);
          }}
          title={createdOfflineBooking ? 'Walk-in OP Ticket Issued' : 'Create Offline Walk-in OP Booking'}
          maxWidth="md"
        >
          {createdOfflineBooking ? (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Walk-in OP Appointment Confirmed
                </h3>
                <div className="text-3xl font-black text-emerald-700 tracking-wider">
                  TOKEN #{createdOfflineBooking.tokenNumber}
                </div>
                <div className="font-mono text-slate-600 text-xs">
                  MRN: <strong className="text-slate-900">{createdOfflineBooking.patient?.patientIdNumber || 'PENDING'}</strong>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-1.5 border border-slate-200 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Patient:</span>
                  <span className="font-bold text-slate-900">{createdOfflineBooking.patient?.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Doctor:</span>
                  <span className="font-bold text-royal-700">Dr. {createdOfflineBooking.doctor?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span>{createdOfflineBooking.doctor?.specialization || 'OPD'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Channel:</span>
                  <span className="font-bold text-amber-700">OFFLINE (Walk-in)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-600">{createdOfflineBooking.status}</span>
                </div>
              </div>

              <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-royal-200 text-royal-700 hover:bg-royal-50 font-bold flex items-center gap-1.5"
                  onClick={() =>
                    handleDownloadOpSlip(
                      createdOfflineBooking.id,
                      createdOfflineBooking.digitalOp?.opNumber
                    )
                  }
                  disabled={downloadingSlipId === createdOfflineBooking.id}
                >
                  {downloadingSlipId === createdOfflineBooking.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-royal-600" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-royal-600" />
                  )}
                  {downloadingSlipId === createdOfflineBooking.id
                    ? 'Downloading...'
                    : 'Download OP Slip (PDF)'}
                </Button>
                <Button
                  size="sm"
                  className="bg-royal-600 hover:bg-royal-700 text-white font-bold"
                  onClick={() => {
                    setIsOfflineBookingOpen(false);
                    setCreatedOfflineBooking(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!offlineDoctorId || !offlinePatientName || !offlineMobile) {
                  toast.error('Validation Error', 'Doctor, Patient name, and 10-digit mobile number are required.');
                  return;
                }
                const selectedDoc = doctors?.find((d) => d.id === offlineDoctorId);
                createOfflineBookingMutation.mutate({
                  doctorId: offlineDoctorId,
                  departmentId: selectedDoc?.departmentId,
                  appointmentDate: new Date().toISOString().split('T')[0],
                  patient: {
                    fullName: offlinePatientName.trim(),
                    mobileNumber: offlineMobile.trim(),
                    email: offlineEmail.trim() || undefined,
                    age: offlineAge ? Number(offlineAge) : undefined,
                    gender: offlineGender,
                    bloodGroup: offlineBloodGroup,
                    address: offlineAddress.trim() || undefined,
                    emergencyContact: offlineEmergencyContact.trim() || undefined,
                  },
                  consultationFee: Number(offlineFee) || 500,
                  notes: offlineNotes.trim() || undefined,
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assign Doctor <span className="text-rose-500">*</span>
                </label>
                <select
                  value={offlineDoctorId}
                  onChange={(e) => {
                    setOfflineDoctorId(e.target.value);
                    const doc = doctors?.find((d) => d.id === e.target.value);
                    if (doc) setOfflineFee(doc.consultationFee);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                  required
                >
                  <option value="">Select an available Doctor...</option>
                  {(doctors || []).map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.name} - {doc.specialization} (Fee: ₹{doc.consultationFee})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Patient Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={offlinePatientName}
                    onChange={(e) => setOfflinePatientName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-royal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mobile Number (10 digits) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={offlineMobile}
                    onChange={(e) => setOfflineMobile(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-royal-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    value={offlineAge}
                    onChange={(e) => setOfflineAge(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="42"
                    min={0}
                    max={125}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={offlineGender}
                    onChange={(e) => setOfflineGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={offlineBloodGroup}
                    onChange={(e) => setOfflineBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={offlineEmail}
                    onChange={(e) => setOfflineEmail(e.target.value)}
                    placeholder="patient@email.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    value={offlineFee}
                    onChange={(e) => setOfflineFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Residential Address (Optional)</label>
                <input
                  type="text"
                  value={offlineAddress}
                  onChange={(e) => setOfflineAddress(e.target.value)}
                  placeholder="Street / City / Locality"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Walk-in Triage / Visit Notes</label>
                <textarea
                  rows={2}
                  value={offlineNotes}
                  onChange={(e) => setOfflineNotes(e.target.value)}
                  placeholder="Primary complaint, walk-in emergency notes..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOfflineBookingOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  isLoading={createOfflineBookingMutation.isPending}
                >
                  Confirm Walk-in & Issue Token
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* PATIENT RECORD DETAILS MODAL */}
      {selectedPatientId && (
        <Modal
          isOpen={!!selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
          title={`Hospital Patient Record: ${patientDetails?.fullName || 'Loading...'}`}
          maxWidth="lg"
        >
          {patientDetailsLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading medical records and history...
            </div>
          ) : !patientDetails ? (
            <div className="py-8 text-center text-xs text-rose-500">
              Patient record could not be loaded.
            </div>
          ) : (
            <div className="space-y-5 text-xs max-h-[75vh] overflow-y-auto pr-1">
              {/* Demographics Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">MRN / ID</span>
                  <span className="font-mono font-bold text-royal-700 text-sm">
                    {patientDetails.patientIdNumber || 'MRN-PENDING'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Mobile</span>
                  <span className="font-semibold text-slate-900">{patientDetails.mobileNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Age / Gender</span>
                  <span className="font-semibold text-slate-900">
                    {patientDetails.age ? `${patientDetails.age} Yrs` : '--'} • {patientDetails.gender || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Blood Group</span>
                  <span className="font-bold text-rose-600">{patientDetails.bloodGroup || 'Unknown'}</span>
                </div>
              </div>

              {/* Consultation History */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-royal-600" />
                  Hospital OP Visit History ({(patientDetails.appointments || []).length})
                </h4>
                <div className="space-y-2">
                  {(patientDetails.appointments || []).length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-slate-400 text-center">
                      No prior appointments on record for this hospital.
                    </div>
                  ) : (
                    (patientDetails.appointments || []).map((apt: any) => (
                      <div
                        key={apt.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            Dr. {apt.doctor?.name} ({apt.doctor?.specialization})
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {apt.bookingType || 'ONLINE'} • Token #{apt.tokenNumber}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Date: {new Date(apt.appointmentDate).toLocaleDateString()} • Status: <span className="font-bold text-slate-800">{apt.status}</span>
                        </div>
                        {apt.prescription && (
                          <div className="mt-1 p-2 bg-royal-50/50 rounded-lg text-slate-700">
                            <span className="font-bold text-royal-800">Diagnosis:</span> {apt.prescription.diagnosis}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Vitals History */}
              {patientDetails.vitals && patientDetails.vitals.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-teal-600" />
                    Recorded Clinical Vitals History ({patientDetails.vitals.length})
                  </h4>
                  <div className="space-y-2">
                    {patientDetails.vitals.map((v: any) => (
                      <div key={v.id} className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60 space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Recorded: {new Date(v.createdAt).toLocaleString()}</span>
                          <span className="font-semibold text-teal-800">
                            By: {v.recordedBy?.user?.name || v.recordedBy?.name || 'Support Staff'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-slate-800 pt-1">
                          <div>BP: <strong className="font-bold">{v.bloodPressure || `${v.bpSystolic}/${v.bpDiastolic}`}</strong></div>
                          <div>Pulse: <strong className="font-bold">{v.pulseRate} bpm</strong></div>
                          <div>Temp: <strong className="font-bold">{v.temperature}°F</strong></div>
                          <div>SpO₂: <strong className="font-bold">{v.spo2}%</strong></div>
                        </div>
                        {v.notes && (
                          <div className="text-[11px] text-slate-600 pt-1">
                            <em>Note: {v.notes}</em>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button size="sm" variant="outline" onClick={() => setSelectedPatientId(null)}>
                  Close Record
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* CREATE SUB-ADMINISTRATOR MODAL */}
      {isCreateSubAdminOpen && (
        <Modal
          isOpen={isCreateSubAdminOpen}
          onClose={() => setIsCreateSubAdminOpen(false)}
          title="Create Hospital Sub-Administrator"
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!subAdminName || !subAdminEmail || !subAdminPassword) {
                toast.error('Validation Error', 'Name, email, and password are required.');
                return;
              }
              if (subAdminPermissionsState.length === 0) {
                toast.error('Privileges Error', 'Select at least one granular permission for this sub-admin.');
                return;
              }
              createSubAdminMutation.mutate({
                name: subAdminName.trim(),
                email: subAdminEmail.trim(),
                password: subAdminPassword,
                phone: subAdminPhone.trim() || undefined,
                roleTitle: subAdminRoleTitle.trim(),
                permissions: subAdminPermissionsState,
              });
            }}
            className="space-y-4 text-xs"
          >
            <p className="text-slate-500">
              Provision a delegated hospital sub-administrator with scoped administrative permissions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={subAdminName}
                  onChange={(e) => setSubAdminName(e.target.value)}
                  placeholder="e.g. Reception Head"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Official Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={subAdminEmail}
                  onChange={(e) => setSubAdminEmail(e.target.value)}
                  placeholder="reception@hospital.org"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Login Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={subAdminPassword}
                  onChange={(e) => setSubAdminPassword(e.target.value)}
                  placeholder="Password@123"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Title / Designation</label>
                <input
                  type="text"
                  value={subAdminRoleTitle}
                  onChange={(e) => setSubAdminRoleTitle(e.target.value)}
                  placeholder="OP Operations Lead"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Granular Permissions Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block font-bold text-slate-800">
                Granular Scoped Permissions <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {[
                  { id: 'OP_MANAGEMENT', label: 'OP Management (Manage queues, issue offline walk-in tokens)' },
                  { id: 'DOCTOR_MANAGEMENT', label: 'Doctor Management (View doctor schedules & rosters)' },
                  { id: 'PATIENT_RECORDS', label: 'Patient Medical Records (View hospital MRN directory & past visits)' },
                  { id: 'VITALS_MANAGEMENT', label: 'Vitals Management (Access triage queue and nurse approvals)' },
                  { id: 'BILLING_REPORTS', label: 'Financial & OPD Analytics Reports' },
                ].map((perm) => (
                  <label key={perm.id} className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={subAdminPermissionsState.includes(perm.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSubAdminPermissionsState([...subAdminPermissionsState, perm.id]);
                        } else {
                          setSubAdminPermissionsState(subAdminPermissionsState.filter((p) => p !== perm.id));
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreateSubAdminOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                isLoading={createSubAdminMutation.isPending}
              >
                Provision Sub-Admin
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT SUB-ADMIN PERMISSIONS MODAL */}
      {editingSubAdmin && (
        <Modal
          isOpen={!!editingSubAdmin}
          onClose={() => setEditingSubAdmin(null)}
          title={`Edit Privileges: ${editingSubAdmin.user?.name || editingSubAdmin.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Adjust delegated permissions for <strong className="text-slate-900">{editingSubAdmin.user?.email || editingSubAdmin.email}</strong>.
            </p>

            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {[
                { id: 'OP_MANAGEMENT', label: 'OP Management (Manage queues, issue offline walk-in tokens)' },
                { id: 'DOCTOR_MANAGEMENT', label: 'Doctor Management (View doctor schedules & rosters)' },
                { id: 'PATIENT_RECORDS', label: 'Patient Medical Records (View hospital MRN directory & past visits)' },
                { id: 'VITALS_MANAGEMENT', label: 'Vitals Management (Access triage queue and nurse approvals)' },
                { id: 'BILLING_REPORTS', label: 'Financial & OPD Analytics Reports' },
              ].map((perm) => (
                <label key={perm.id} className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={subAdminPermissionsState.includes(perm.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSubAdminPermissionsState([...subAdminPermissionsState, perm.id]);
                      } else {
                        setSubAdminPermissionsState(subAdminPermissionsState.filter((p) => p !== perm.id));
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setEditingSubAdmin(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                onClick={() => {
                  updateSubAdminMutation.mutate({
                    id: editingSubAdmin.id,
                    data: {
                      permissions: subAdminPermissionsState,
                    },
                  });
                }}
                isLoading={updateSubAdminMutation.isPending}
              >
                Save Privileges
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* HOSPITAL PROFILE & BRANDING MODAL */}
      {isBrandingModalOpen && (
        <Modal
          isOpen={isBrandingModalOpen}
          onClose={() => setIsBrandingModalOpen(false)}
          title={`Hospital Profile & Branding: ${hospitalProfile?.name || user?.hospital?.name || 'Care Hospital'}`}
          maxWidth="2xl"
        >
          <div className="space-y-6 text-sm">
            <p className="text-xs text-slate-500">
              Customize your hospital branding images and official public directory details. Changes will be reflected immediately across patient booking portals, hospital cards, and certificates.
            </p>

            {/* IMAGES & BRANDING SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* HOSPITAL LOGO / EMBLEM */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-royal-600" />
                      Hospital Emblem / Logo
                    </span>
                    <Badge variant="purple" className="text-[10px]">Square 1:1</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Displayed on doctor badges, OP tokens, search cards, and dashboard header.
                  </p>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border-2 border-slate-200 shadow-sm shrink-0 flex items-center justify-center relative">
                      {brandingLogo ? (
                        <img
                          src={getMediaUrl(brandingLogo)}
                          alt="Hospital Logo Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Building2 className="w-8 h-8 text-slate-400" />
                      )}
                      {isUploadingLogo && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                          <InlineSpinner size="sm" className="text-royal-600" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 flex-1">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-royal-600 hover:bg-royal-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        Upload Logo File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleLogoUpload(e.target.files[0]);
                            }
                          }}
                          disabled={isUploadingLogo}
                        />
                      </label>
                      <input
                        type="text"
                        value={brandingLogo}
                        onChange={(e) => setBrandingLogo(e.target.value)}
                        placeholder="Or paste image URL"
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-royal-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* HOSPITAL COVER / BANNER */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      Cover / Exterior Photo
                    </span>
                    <Badge variant="success" className="text-[10px]">Landscape 16:9</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Hero banner on Hospital Page and card on Home Directory.
                  </p>
                  <div className="w-full h-20 rounded-xl overflow-hidden bg-white border-2 border-slate-200 shadow-sm mb-3 relative flex items-center justify-center">
                    {brandingImage ? (
                      <img
                        src={getMediaUrl(brandingImage)}
                        alt="Hospital Cover Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                    )}
                    {isUploadingBanner && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                        <InlineSpinner size="sm" className="text-emerald-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      Upload Banner
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleBannerUpload(e.target.files[0]);
                          }
                        }}
                        disabled={isUploadingBanner}
                      />
                    </label>
                    <input
                      type="text"
                      value={brandingImage}
                      onChange={(e) => setBrandingImage(e.target.value)}
                      placeholder="Or paste banner image URL"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE PREVIEW OF HOSPITAL CARD */}
            <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                Public Directory Card Live Preview
              </span>
              <div className="max-w-sm mx-auto bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                <div className="h-28 w-full bg-slate-200 relative overflow-hidden">
                  <img
                    src={getMediaUrl(brandingImage || brandingLogo) || 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&auto=format&fit=crop&q=80'}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-xl shadow">
                    <img
                      src={getMediaUrl(brandingLogo) || getMediaUrl(brandingImage) || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=150&auto=format&fit=crop&q=80'}
                      alt="Logo"
                      className="w-6 h-6 rounded-lg object-cover border border-slate-200"
                    />
                    <span className="text-xs font-black text-slate-900 truncate max-w-[160px]">
                      {hospitalProfile?.name || user?.hospital?.name || 'Care Hospital'}
                    </span>
                  </div>
                </div>
                <div className="p-3 text-xs text-slate-600 space-y-1">
                  <p className="flex items-center gap-1.5 font-medium text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {brandingAddress || hospitalProfile?.address || 'Hospital Address'}, {brandingCity || hospitalProfile?.city || 'City'}
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {brandingPhone || hospitalProfile?.phone || 'Main helpline'} • Emergency: <span className="font-semibold text-rose-600">{brandingEmergency || hospitalProfile?.emergencyContact || '108'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* DETAILS FORM */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Helpline Phone Number</label>
                <input
                  type="text"
                  value={brandingPhone}
                  onChange={(e) => setBrandingPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-500 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Emergency 24x7 Contact</label>
                <input
                  type="text"
                  value={brandingEmergency}
                  onChange={(e) => setBrandingEmergency(e.target.value)}
                  placeholder="e.g. 108 or 040-23456789"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-500 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Facility Address</label>
                <input
                  type="text"
                  value={brandingAddress}
                  onChange={(e) => setBrandingAddress(e.target.value)}
                  placeholder="Street address / locality"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-500 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">City</label>
                <input
                  type="text"
                  value={brandingCity}
                  onChange={(e) => setBrandingCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">About Hospital</label>
                <textarea
                  rows={2}
                  value={brandingAbout}
                  onChange={(e) => setBrandingAbout(e.target.value)}
                  placeholder="Short description of hospital specialties and facilities..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-500 outline-none"
                />
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsBrandingModalOpen(false)}
                disabled={isSavingBranding}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveBranding}
                isLoading={isSavingBranding}
                className="bg-royal-600 hover:bg-royal-700 text-white font-bold px-5"
              >
                Save Hospital Profile
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* REJECT HOSPITAL LAB MODAL */}
      {rejectingLab && (
        <Modal
          isOpen={!!rejectingLab}
          onClose={() => {
            setRejectingLab(null);
            setLabRejectReason('');
          }}
          title={`Reject Diagnostic Laboratory: ${rejectingLab.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Are you sure you want to reject the laboratory application for{' '}
              <strong className="text-slate-900">{rejectingLab.name}</strong>? You can provide a reason below for the audit trail and technician notification.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for Rejection (Optional)
              </label>
              <textarea
                rows={3}
                value={labRejectReason}
                onChange={(e) => setLabRejectReason(e.target.value)}
                placeholder="e.g. Incomplete diagnostic certification, licensing documentation required..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRejectingLab(null);
                  setLabRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  rejectHospitalLabMutation.mutate({
                    labId: rejectingLab.id,
                    reason: labRejectReason.trim() || undefined,
                  })
                }
                isLoading={rejectHospitalLabMutation.isPending}
                className="text-xs font-bold text-rose-800 bg-rose-50 border-rose-300 hover:bg-rose-100 hover:border-rose-400 shadow-2xs"
              >
                <X className="w-3.5 h-3.5 mr-1 text-rose-600" /> Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* REJECT PHARMACY MODAL */}
      {rejectingPharmacy && (
        <Modal
          isOpen={!!rejectingPharmacy}
          onClose={() => {
            setRejectingPharmacy(null);
            setPharmacyRejectReason('');
          }}
          title={`Reject Pharmacy Registration: ${rejectingPharmacy.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Are you sure you want to reject the hospital pharmacy registration for{' '}
              <strong className="text-slate-900">{rejectingPharmacy.name}</strong>?
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for Rejection (Optional)
              </label>
              <textarea
                rows={3}
                value={pharmacyRejectReason}
                onChange={(e) => setPharmacyRejectReason(e.target.value)}
                placeholder="e.g. Drug license verification mismatch, invalid state pharmacy council registration..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRejectingPharmacy(null);
                  setPharmacyRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  rejectPharmacyMutation.mutate({
                    pharmacyId: rejectingPharmacy.id,
                    reason: pharmacyRejectReason.trim() || undefined,
                  })
                }
                isLoading={rejectPharmacyMutation.isPending}
                className="text-xs font-bold text-rose-800 bg-rose-50 border-rose-300 hover:bg-rose-100 hover:border-rose-400 shadow-2xs"
              >
                <X className="w-3.5 h-3.5 mr-1 text-rose-600" /> Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
