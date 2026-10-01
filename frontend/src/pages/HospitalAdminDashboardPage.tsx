import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/admin.api';
import { appointmentsApi } from '../api/appointments.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { Appointment, Doctor } from '../types';

export const HospitalAdminDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  // Granular Sub-Admin RBAC
  const isSubAdmin = user?.role === 'HOSPITAL_SUB_ADMIN';
  const subPermissions: string[] = user?.subAdminPermissions || [];

  const canManageAppointments = !isSubAdmin || subPermissions.includes('OP_MANAGEMENT');
  const canManageDoctors = !isSubAdmin || subPermissions.includes('DOCTOR_MANAGEMENT');
  const canViewPatients = !isSubAdmin || subPermissions.includes('PATIENT_RECORDS');
  const canManageStaff = !isSubAdmin || subPermissions.includes('VITALS_MANAGEMENT');
  const canManageSubAdmins = !isSubAdmin; // Only Hospital Admin can manage Sub-Admins

  const [activeTab, setActiveTab] = useState<'appointments' | 'doctors' | 'patients' | 'staff' | 'subadmins' | 'notifications'>('appointments');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

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
  const [doctorAccountPassword, setDoctorAccountPassword] = useState('Password@123');

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

  // Fetch appointments
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['admin-appointments', statusFilter, searchQuery, selectedDate],
    queryFn: () =>
      adminApi.getAppointments({
        status: statusFilter,
        search: searchQuery || undefined,
        date: selectedDate || undefined,
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
    onSuccess: () => {
      toast.success('Doctor registered successfully');
      setIsAddDoctorOpen(false);
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
      setDoctorAccountPassword('Password@123');
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
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Hospital Admin Operations Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time outpatient bookings, queue progression, doctor rosters, and revenue
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          {/* Section Tabs */}
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar whitespace-nowrap">
            {canManageAppointments && (
              <button
                onClick={() => setActiveTab('appointments')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 ${
                  activeTab === 'appointments' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Appointments ({metrics?.todayAppointments || 0})
              </button>
            )}

            {canManageDoctors && (
              <button
                onClick={() => setActiveTab('doctors')}
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
                onClick={() => setActiveTab('patients')}
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
                onClick={() => setActiveTab('staff')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'staff' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                Support Staff
              </button>
            )}

            {canManageSubAdmins && (
              <button
                onClick={() => setActiveTab('subadmins')}
                className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'subadmins' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-indigo-600" />
                Sub-Admins
              </button>
            )}

            <button
              onClick={() => setActiveTab('notifications')}
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

      {/* KPI METRIC CARDS */}
      <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-4 lg:grid-cols-7 gap-3 pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Today's Total</span>
          <div className="text-2xl font-black text-slate-900">{metrics?.todayAppointments || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Upcoming</span>
          <div className="text-2xl font-black text-royal-600">{metrics?.upcomingAppointments || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Completed</span>
          <div className="text-2xl font-black text-emerald-600">{metrics?.completedAppointments || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Cancelled</span>
          <div className="text-2xl font-black text-rose-600">{metrics?.cancelledAppointments || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">No Shows</span>
          <div className="text-2xl font-black text-slate-600">{metrics?.noShowAppointments || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Today's Revenue</span>
          <div className="text-2xl font-black text-royal-700">₹{metrics?.todayRevenue || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Patients</span>
          <div className="text-2xl font-black text-slate-900">{metrics?.patientCount || 0}</div>
        </div>
      </div>

      {/* TAB 1: APPOINTMENTS MANAGEMENT */}
      {activeTab === 'appointments' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm space-y-4">
          {/* Filters Bar */}
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
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
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-medium"
                />
              </div>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, mobile, OP..."
                className="w-full bg-transparent focus:outline-none text-slate-900 placeholder:text-slate-400"
              />
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
                  <th className="px-5 py-3.5 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {appointmentsLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      Loading appointments...
                    </td>
                  </tr>
                ) : !appointments || appointments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
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
                            <span className="font-mono text-[11px] font-bold text-royal-800 bg-royal-50 px-2 py-0.5 rounded">
                              {apt.digitalOp.opNumber}
                            </span>
                            <a
                              href={appointmentsApi.getPdfUrl(apt.id)}
                              download
                              className="flex items-center gap-1 text-[11px] text-royal-600 hover:underline pt-0.5"
                            >
                              <Download className="w-3 h-3" /> PDF Slip
                            </a>
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
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {apt.status === 'CONFIRMED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] px-2 py-1 text-royal-700 bg-royal-50 border-royal-200 hover:bg-royal-100"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: apt.id, status: 'WAITING' })
                              }
                            >
                              <UserCheck className="w-3 h-3 mr-1" /> Mark Arrived
                            </Button>
                          )}

                          {apt.status === 'WAITING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] px-2 py-1 text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: apt.id, status: 'IN_CONSULTATION' })
                              }
                            >
                              In Consultation
                            </Button>
                          )}

                          {apt.status === 'IN_CONSULTATION' && (
                            <Button
                              variant="success"
                              size="sm"
                              className="text-[10px] px-2 py-1"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: apt.id, status: 'COMPLETED' })
                              }
                            >
                              Complete
                            </Button>
                          )}

                          {apt.status !== 'COMPLETED' && apt.status !== 'CANCELLED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] text-rose-600 hover:bg-rose-50 px-2 py-1"
                              onClick={() => {
                                if (window.confirm('Cancel this appointment?')) {
                                  updateStatusMutation.mutate({ id: apt.id, status: 'CANCELLED' });
                                }
                              }}
                            >
                              Cancel
                            </Button>
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
                          className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 py-1.5"
                          onClick={() => {
                            setRejectingDoctor(pDoc);
                            setDoctorRejectReason('');
                          }}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Reject
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
                                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                                onClick={() => {
                                  setRejectingDoctor(doc);
                                  setDoctorRejectReason('');
                                }}
                              >
                                Reject
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

            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search MRN, Name, or Mobile..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
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
                              size="sm"
                              variant="outline"
                              className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                              onClick={() => rejectStaffMutation.mutate(staff.id)}
                            >
                              <X className="w-3 h-3 mr-1" /> Reject
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
                toast.error('Validation Error', 'Please complete all required fields.');
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
              };
              if (doctorAccountEmail.trim()) {
                payload.userAccount = {
                  email: doctorAccountEmail.trim(),
                  password: doctorAccountPassword || 'Password@123',
                };
              }
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

            {/* Associated Doctor Account Email */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-1.5 text-xs">
              <span className="font-bold text-royal-900 block">
                Doctor Portal Account Link (Self-Registered Email)
              </span>
              <p className="text-slate-600 text-[11px]">
                Enter the official email if the doctor already self-registered their portal account. Doctors maintain their own secure login passwords independently.
              </p>
              <input
                type="email"
                value={doctorAccountEmail}
                onChange={(e) => setDoctorAccountEmail(e.target.value)}
                placeholder="doctor.email@hospital.org"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
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

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
                createOfflineBookingMutation.mutate({
                  doctorId: offlineDoctorId,
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
    </div>
  );
};
