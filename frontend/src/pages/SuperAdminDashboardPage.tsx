import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Users,
  Calendar,
  IndianRupee,
  ShieldCheck,
  Activity,
  Layers,
  FileText,
  Plus,
  Trash2,
  UserPlus,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  FileSpreadsheet,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { superAdminApi } from '../api/superAdmin.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

export const SuperAdminDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'hospitals' | 'pending' | 'doctors' | 'appointments' | 'audit' | 'analytics' | 'labs'>('hospitals');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['hospitals', 'pending', 'doctors', 'appointments', 'audit', 'analytics', 'labs'].includes(hash)) {
        setActiveTab(hash as any);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Analytics Filter States
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');
  const [analyticsHospitalId, setAnalyticsHospitalId] = useState('');
  const [analyticsDoctorId, setAnalyticsDoctorId] = useState('');
  const [analyticsStatus, setAnalyticsStatus] = useState('');
  const [analyticsBookingType, setAnalyticsBookingType] = useState('');
  const [expandedHospitals, setExpandedHospitals] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);

  // Lab approval & rejection states
  const [rejectingLab, setRejectingLab] = useState<any | null>(null);
  const [labRejectReason, setLabRejectReason] = useState('');

  // Modal states
  const [isAddHospitalOpen, setIsAddHospitalOpen] = useState(false);
  const [provisionAdminHospital, setProvisionAdminHospital] = useState<any | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedRejectHospital, setSelectedRejectHospital] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('Application does not meet current platform accreditation criteria.');

  // New Hospital Form State
  const [newHospital, setNewHospital] = useState({
    name: '',
    code: '',
    about: '',
    address: '',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
    phone: '+91 40 2360 7777',
    emergencyPhone: '1066',
    email: '',
    rating: 4.8,
    isEmergencyAvailable: true,
    facilities: '24/7 Emergency, Cardiac ICU, Level-1 Trauma, Diagnostics, Multi-Speciality OT',
    imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&auto=format&fit=crop&q=80',
    logoUrl: '',
  });

  // Provision Admin Form State
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('Password@123');

  // Filters for other tabs
  const [doctorSearch, setDoctorSearch] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('ALL');
  const [labStatusFilter, setLabStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [labSearchQuery, setLabSearchQuery] = useState('');

  // Queries
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['super-admin-metrics'],
    queryFn: () => superAdminApi.getMetrics(),
    refetchInterval: 12000,
  });

  const { data: hospitals, isLoading: hospitalsLoading } = useQuery({
    queryKey: ['super-admin-hospitals'],
    queryFn: () => superAdminApi.getHospitals(),
  });

  const { data: pendingHospitals, isLoading: pendingLoading } = useQuery({
    queryKey: ['super-admin-pending-hospitals'],
    queryFn: () => superAdminApi.getPendingHospitals(),
    refetchInterval: 10000,
  });

  const { data: networkDoctors, isLoading: doctorsLoading } = useQuery({
    queryKey: ['super-admin-doctors', doctorSearch],
    queryFn: () => superAdminApi.getAllDoctors({ search: doctorSearch || undefined }),
    enabled: activeTab === 'doctors',
  });

  const { data: platformAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['super-admin-appointments', appointmentStatusFilter],
    queryFn: () =>
      superAdminApi.getAllAppointments({
        status: appointmentStatusFilter === 'ALL' ? undefined : appointmentStatusFilter,
        limit: 50,
      }),
    enabled: activeTab === 'appointments',
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['super-admin-audit-logs'],
    queryFn: () => superAdminApi.getAuditLogs(50),
    enabled: activeTab === 'audit',
  });

  // OP & Booking Analytics Query
  const { data: opAnalytics, isLoading: analyticsLoading, refetch: refetchOpAnalytics } = useQuery({
    queryKey: [
      'super-admin-op-analytics',
      analyticsStartDate,
      analyticsEndDate,
      analyticsHospitalId,
      analyticsDoctorId,
      analyticsStatus,
      analyticsBookingType,
    ],
    queryFn: () =>
      superAdminApi.getOpAnalytics({
        startDate: analyticsStartDate || undefined,
        endDate: analyticsEndDate || undefined,
        hospitalId: analyticsHospitalId || undefined,
        doctorId: analyticsDoctorId || undefined,
        status: analyticsStatus || undefined,
        bookingType: analyticsBookingType || undefined,
      }),
    enabled: activeTab === 'analytics',
  });

  // Diagnostic Labs Query (All Labs with Status)
  const {
    data: allLabsData,
    isLoading: labsLoading,
    refetch: refetchLabs,
    isFetching: labsFetching,
  } = useQuery({
    queryKey: ['super-admin-labs'],
    queryFn: () => superAdminApi.getAllLabs(),
    enabled: activeTab === 'labs',
    refetchInterval: 12000,
  });

  const labsList: any[] = allLabsData || [];
  const pendingLabsCount = labsList.filter((l: any) => l.status === 'PENDING').length;
  const approvedLabsCount = labsList.filter((l: any) => l.status === 'APPROVED' || l.status === 'ACTIVE').length;
  const rejectedLabsCount = labsList.filter((l: any) => l.status === 'REJECTED').length;

  const filteredLabs = labsList.filter((lab: any) => {
    if (labStatusFilter === 'PENDING' && lab.status !== 'PENDING') return false;
    if (labStatusFilter === 'APPROVED' && lab.status !== 'APPROVED' && lab.status !== 'ACTIVE') return false;
    if (labStatusFilter === 'REJECTED' && lab.status !== 'REJECTED') return false;

    if (labSearchQuery.trim()) {
      const q = labSearchQuery.toLowerCase();
      const matchName = lab.name?.toLowerCase().includes(q);
      const matchCity = lab.city?.toLowerCase().includes(q);
      const matchLicense = lab.licenseNumber?.toLowerCase().includes(q);
      const matchEmail = lab.email?.toLowerCase().includes(q);
      return Boolean(matchName || matchCity || matchLicense || matchEmail);
    }
    return true;
  });

  // Lab Approval & Rejection Mutations
  const approveLabMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.approveLab(id),
    onSuccess: () => {
      toast.success('Lab Accredited', 'Diagnostic laboratory accreditation approved successfully');
      queryClient.invalidateQueries({ queryKey: ['super-admin-labs'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-pending-labs'] });
    },
    onError: (err: any) => {
      toast.error('Approval Error', err.message);
    },
  });

  const rejectLabMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => superAdminApi.rejectLab(id, reason),
    onSuccess: () => {
      toast.info('Lab Application Rejected', 'Diagnostic laboratory application has been rejected');
      setRejectingLab(null);
      setLabRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['super-admin-labs'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-pending-labs'] });
    },
    onError: (err: any) => {
      toast.error('Rejection Error', err.message);
    },
  });

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const blob = await superAdminApi.exportBookingsExcel({
        startDate: analyticsStartDate || undefined,
        endDate: analyticsEndDate || undefined,
        hospitalId: analyticsHospitalId || undefined,
        doctorId: analyticsDoctorId || undefined,
        status: analyticsStatus || undefined,
        bookingType: analyticsBookingType || undefined,
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `MedPulse_OP_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Export Successful', 'OP Booking Analytics report exported to Excel (.xlsx)');
    } catch (err: any) {
      toast.error('Export Error', err.message || 'Could not export Excel file');
    } finally {
      setIsExporting(false);
    }
  };

  // Approval & Status Mutations
  const approveHospitalMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.approveHospital(id),
    onSuccess: () => {
      toast.success('Hospital Approved', 'Healthcare center accreditation approved and activated on platform');
      queryClient.invalidateQueries({ queryKey: ['super-admin-pending-hospitals'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-hospitals'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Approval Error', err.message);
    },
  });

  const rejectHospitalMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => superAdminApi.rejectHospital(id, reason),
    onSuccess: () => {
      toast.info('Application Rejected', 'Hospital registration application has been rejected');
      setIsRejectModalOpen(false);
      setSelectedRejectHospital(null);
      queryClient.invalidateQueries({ queryKey: ['super-admin-pending-hospitals'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-hospitals'] });
    },
    onError: (err: any) => {
      toast.error('Rejection Error', err.message);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.toggleHospitalStatus(id),
    onSuccess: (res: any) => {
      toast.success('Status Updated', `Hospital status set to ${res?.data?.status || 'UPDATED'}`);
      queryClient.invalidateQueries({ queryKey: ['super-admin-hospitals'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-pending-hospitals'] });
    },
    onError: (err: any) => {
      toast.error('Status Toggle Failed', err.message);
    },
  });

  // Mutations
  const createHospitalMutation = useMutation({
    mutationFn: (data: any) => superAdminApi.createHospital(data),
    onSuccess: () => {
      toast.success('Hospital Onboarded', 'New hospital facility added to the national network');
      setIsAddHospitalOpen(false);
      setNewHospital({
        name: '',
        code: '',
        about: '',
        address: '',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        phone: '+91 40 2360 7777',
        emergencyPhone: '1066',
        email: '',
        rating: 4.8,
        isEmergencyAvailable: true,
        facilities: '24/7 Emergency, Cardiac ICU, Level-1 Trauma, Diagnostics, Multi-Speciality OT',
        imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&auto=format&fit=crop&q=80',
        logoUrl: '',
      });
      queryClient.invalidateQueries({ queryKey: ['super-admin-hospitals'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Failed to Onboard Hospital', err.message);
    },
  });

  const provisionAdminMutation = useMutation({
    mutationFn: ({ hospitalId, data }: { hospitalId: string; data: any }) =>
      superAdminApi.createHospitalAdmin(hospitalId, data),
    onSuccess: () => {
      toast.success('Administrator Provisioned', 'Hospital Admin credentials created and activated');
      setProvisionAdminHospital(null);
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('Password@123');
      queryClient.invalidateQueries({ queryKey: ['super-admin-hospitals'] });
    },
    onError: (err: any) => {
      toast.error('Provisioning Failed', err.message);
    },
  });

  const deleteHospitalMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteHospital(id),
    onSuccess: () => {
      toast.success('Hospital Removed', 'Facility successfully deleted from network');
      queryClient.invalidateQueries({ queryKey: ['super-admin-hospitals'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-metrics'] });
    },
    onError: (err: any) => {
      toast.error('Failed to Delete', err.message);
    },
  });

  const handleCreateHospital = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHospital.name || !newHospital.code || !newHospital.city || !newHospital.address) {
      toast.error('Validation Error', 'Please complete all required hospital facility fields.');
      return;
    }

    const facilitiesArray = newHospital.facilities
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    createHospitalMutation.mutate({
      name: newHospital.name.trim(),
      code: newHospital.code.trim().toUpperCase(),
      about: newHospital.about.trim() || `${newHospital.name} multi-speciality tertiary care hospital facility.`,
      address: newHospital.address.trim(),
      city: newHospital.city.trim(),
      state: newHospital.state.trim(),
      pincode: newHospital.pincode.trim(),
      phone: newHospital.phone.trim(),
      emergencyContact: newHospital.emergencyPhone.trim(),
      email: newHospital.email.trim() || undefined,
      rating: Number(newHospital.rating) || 4.8,
      isEmergencyAvailable: Boolean(newHospital.isEmergencyAvailable),
      facilities: facilitiesArray,
      imageUrl: newHospital.imageUrl.trim() || undefined,
      logoUrl: newHospital.logoUrl.trim() || undefined,
    });
  };

  const handleProvisionAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      toast.error('Validation Error', 'Admin name, official email, and secure password are required.');
      return;
    }

    provisionAdminMutation.mutate({
      hospitalId: provisionAdminHospital.id,
      data: {
        name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
        roleTitle: 'Hospital Administrator',
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Title & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Super Admin Platform Oversight
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            National hospital network management, revenue analytics, and system audit trail
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar whitespace-nowrap">
          <button
            onClick={() => setActiveTab('hospitals')}
            className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 ${
              activeTab === 'hospitals' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hospitals Network ({(hospitals || []).length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              activeTab === 'pending' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Pending Approvals
            {(pendingHospitals || []).length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {(pendingHospitals || []).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('doctors')}
            className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 ${
              activeTab === 'doctors' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Network Doctors
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 ${
              activeTab === 'appointments' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Platform Appointments
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              activeTab === 'analytics' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-royal-600" />
            OP & Booking Analytics
          </button>
          <button
            onClick={() => setActiveTab('labs')}
            className={`px-3.5 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              activeTab === 'labs' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
            Labs Accreditation
            {pendingLabsCount > 0 && (
              <span className="bg-purple-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {pendingLabsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Hospitals</span>
          <div className="text-2xl font-black text-royal-600">{metrics?.totalHospitals || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Doctors</span>
          <div className="text-2xl font-black text-pink-600">{metrics?.totalDoctors || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Today's Appointments</span>
          <div className="text-2xl font-black text-slate-900">{metrics?.todayAppointments || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Bookings</span>
          <div className="text-2xl font-black text-slate-900">{metrics?.totalAppointments || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Network Revenue</span>
          <div className="text-2xl font-black text-slate-900">₹{metrics?.totalRevenue || 0}</div>
        </div>

        <div className="min-w-[130px] sm:min-w-0 snap-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 shrink-0 sm:shrink">
          <span className="text-[10px] uppercase font-bold text-slate-400">Convenience Fees</span>
          <div className="text-2xl font-black text-emerald-600">₹{metrics?.platformFeeRevenue || 0}</div>
        </div>
      </div>

      {/* TAB 1: HOSPITALS MANAGEMENT TABLE */}
      {activeTab === 'hospitals' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-royal-600" />
              Accredited Hospital Network Directory ({(hospitals || []).length})
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setIsAddHospitalOpen(true)}
              className="bg-royal-600 hover:bg-royal-700 font-bold text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Onboard New Hospital
            </Button>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Hospital Name</th>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">Doctors</th>
                  <th className="px-5 py-3.5">Departments</th>
                  <th className="px-5 py-3.5">Appointments</th>
                  <th className="px-5 py-3.5">Admin Account</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {hospitalsLoading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400">
                      Loading hospitals network...
                    </td>
                  </tr>
                ) : (hospitals || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400">
                      No hospitals registered yet. Click 'Onboard New Hospital' to add your first facility.
                    </td>
                  </tr>
                ) : (
                  (hospitals || []).map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900">
                        <div>{h.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{h.phone}</div>
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-royal-700">{h.code}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {h.city}, {h.state}
                      </td>
                      <td className="px-5 py-4 font-semibold">{h._count?.doctors || 0}</td>
                      <td className="px-5 py-4">{h._count?.departments || 0}</td>
                      <td className="px-5 py-4 font-bold text-slate-900">{h._count?.appointments || 0}</td>
                      <td className="px-5 py-4">
                        {h.hospitalAdmins?.[0]?.user?.email ? (
                          <span className="text-slate-700 font-medium">
                            {h.hospitalAdmins[0].user.email}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={
                              h.status === 'ACTIVE'
                                ? 'success'
                                : h.status === 'INACTIVE'
                                ? 'default'
                                : h.status === 'REJECTED'
                                ? 'danger'
                                : 'warning'
                            }
                            className="text-[10px]"
                          >
                            {h.status || 'ACTIVE'}
                          </Badge>
                          {h.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => toggleStatusMutation.mutate(h.id)}
                              className="text-[10px] text-amber-600 hover:text-amber-800 underline font-semibold ml-1"
                              title="Deactivate hospital access"
                            >
                              Deactivate
                            </button>
                          ) : h.status === 'INACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => toggleStatusMutation.mutate(h.id)}
                              className="text-[10px] text-emerald-600 hover:text-emerald-800 underline font-semibold ml-1"
                              title="Activate hospital access"
                            >
                              Activate
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[11px] px-2 py-1"
                            onClick={() => {
                              setProvisionAdminHospital(h);
                              setAdminEmail(`admin.${h.code.toLowerCase()}@medipulse.org`);
                              setAdminName(`${h.name} Admin`);
                            }}
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            {h.hospitalAdmins?.length > 0 ? '+ Another Admin' : 'Assign Admin'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[11px] px-2 py-1 text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              if (window.confirm(`Delete hospital "${h.name}" and remove from network?`)) {
                                deleteHospitalMutation.mutate(h.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      {/* TAB: PENDING HOSPITAL APPROVALS */}
      {activeTab === 'pending' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Pending Hospital Applications ({(pendingHospitals || []).length})
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Review healthcare accreditation applications, contact administrator, and grant platform access
              </p>
            </div>
          </CardHeader>

          <div className="p-5">
            {pendingLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Loading pending hospital applications...
              </div>
            ) : (pendingHospitals || []).length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">All Applications Processed</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  There are currently no hospital registration applications awaiting review.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {(pendingHospitals || []).map((h: any) => {
                  const admin = h.hospitalAdmins?.[0]?.user;
                  return (
                    <div
                      key={h.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900">{h.name}</h3>
                            <span className="font-mono text-xs font-bold text-royal-700 bg-royal-50 px-2 py-0.5 rounded-md border border-royal-200">
                              {h.code}
                            </span>
                            <Badge variant="warning" className="text-[10px]">
                              AWAITING APPROVAL
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {h.address}, {h.city}, {h.state} - {h.pincode}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRejectHospital(h);
                              setIsRejectModalOpen(true);
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold"
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approveHospitalMutation.mutate(h.id)}
                            isLoading={approveHospitalMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Approve & Activate
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Administrator Contact
                          </span>
                          <div className="font-bold text-slate-800">{admin?.name || 'Administrator'}</div>
                          <div className="text-slate-600">{admin?.email || h.email}</div>
                          {admin?.phone && <div className="text-slate-500">{admin.phone}</div>}
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Hospital Contacts
                          </span>
                          <div className="text-slate-700">Phone: {h.phone}</div>
                          <div className="text-slate-700">Emergency: {h.emergencyContact}</div>
                          {h.website && (
                            <a
                              href={h.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-royal-600 hover:underline flex items-center gap-1"
                            >
                              Website <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Applied On
                          </span>
                          <div className="text-slate-800 font-medium">
                            {new Date(h.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            {new Date(h.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>

                      {h.about && (
                        <div className="text-xs text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                          <strong className="text-slate-700">About / Accreditation:</strong> {h.about}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* TAB 2: NETWORK DOCTORS */}
      {activeTab === 'doctors' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden space-y-4">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-royal-600" />
              All Doctors Across Network ({(networkDoctors || []).length})
            </CardTitle>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder="Search doctor or specialization..."
                className="w-full bg-transparent focus:outline-none text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Doctor</th>
                  <th className="px-5 py-3.5">Hospital</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Specialization</th>
                  <th className="px-5 py-3.5">Experience</th>
                  <th className="px-5 py-3.5">Consultation Fee</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {doctorsLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      Loading network doctors...
                    </td>
                  </tr>
                ) : (networkDoctors || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      No doctors matching the search criteria.
                    </td>
                  </tr>
                ) : (
                  (networkDoctors || []).map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900">{doc.name}</td>
                      <td className="px-5 py-4 font-medium text-slate-800">{doc.hospital?.name}</td>
                      <td className="px-5 py-4 text-royal-600 font-semibold">{doc.department?.name}</td>
                      <td className="px-5 py-4 text-slate-600">{doc.specialization}</td>
                      <td className="px-5 py-4 font-medium">{doc.experienceYears} Years</td>
                      <td className="px-5 py-4 font-bold text-slate-900">₹{doc.consultationFee}</td>
                      <td className="px-5 py-4">
                        <Badge variant={doc.isActive ? 'success' : 'default'} className="text-[10px]">
                          {doc.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: PLATFORM APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden space-y-4">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-royal-600" />
              Platform Appointments Feed ({(platformAppointments || []).length})
            </CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Filter Status:</span>
              <select
                value={appointmentStatusFilter}
                onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="WAITING">Waiting (Arrived)</option>
                <option value="IN_CONSULTATION">In Consultation</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Token</th>
                  <th className="px-5 py-3.5">Patient Details</th>
                  <th className="px-5 py-3.5">Hospital</th>
                  <th className="px-5 py-3.5">Doctor</th>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {appointmentsLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      Loading appointments feed...
                    </td>
                  </tr>
                ) : (platformAppointments || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      No appointments found matching filter.
                    </td>
                  </tr>
                ) : (
                  (platformAppointments || []).map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-black text-slate-900">
                        #{String(apt.tokenNumber).padStart(2, '0')}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{apt.patient?.fullName}</div>
                        <div className="text-[11px] text-slate-500">+91 {apt.patient?.mobileNumber}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800">{apt.hospital?.name}</td>
                      <td className="px-5 py-4 font-medium text-slate-700">{apt.doctor?.name}</td>
                      <td className="px-5 py-4">
                        <div>{apt.appointmentDate}</div>
                        <div className="text-[10px] text-slate-400">{apt.timeSlot}</div>
                      </td>
                      <td className="px-5 py-4 font-black text-slate-900">₹{apt.totalAmount}</td>
                      <td className="px-5 py-4">
                        <Badge
                          variant={
                            apt.status === 'COMPLETED'
                              ? 'success'
                              : apt.status === 'IN_CONSULTATION'
                              ? 'purple'
                              : apt.status === 'CANCELLED'
                              ? 'danger'
                              : 'gold'
                          }
                          className="text-[10px]"
                        >
                          {apt.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: SYSTEM AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Security & System Audit Log Trail
            </CardTitle>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logsLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : (auditLogs || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">
                      No system logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  (auditLogs || []).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {log.user?.name || 'System / Guest'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-600">{log.entity}</td>
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                        {log.details || '--'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 5: REAL-TIME HIERARCHICAL OP & BOOKING ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <Card className="rounded-2xl border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={analyticsStartDate}
                    onChange={(e) => setAnalyticsStartDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={analyticsEndDate}
                    onChange={(e) => setAnalyticsEndDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Hospital Filter
                  </label>
                  <select
                    value={analyticsHospitalId}
                    onChange={(e) => setAnalyticsHospitalId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                  >
                    <option value="">All Hospitals</option>
                    {(hospitals || []).map((h: any) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={analyticsStatus}
                    onChange={(e) => setAnalyticsStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="CONFIRMED">Confirmed / Booked</option>
                    <option value="WAITING">Waiting (Triage Done)</option>
                    <option value="IN_CONSULTATION">In Consultation</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Booking Channel
                  </label>
                  <select
                    value={analyticsBookingType}
                    onChange={(e) => setAnalyticsBookingType(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                  >
                    <option value="">Online & Walk-in</option>
                    <option value="ONLINE">Online Portal</option>
                    <option value="OFFLINE">Offline Walk-in OP</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 lg:pt-5 shrink-0">
                {(analyticsStartDate || analyticsEndDate || analyticsHospitalId || analyticsStatus || analyticsBookingType) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAnalyticsStartDate('');
                      setAnalyticsEndDate('');
                      setAnalyticsHospitalId('');
                      setAnalyticsDoctorId('');
                      setAnalyticsStatus('');
                      setAnalyticsBookingType('');
                    }}
                    className="text-xs"
                  >
                    Reset
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchOpAnalytics()}
                  disabled={analyticsLoading}
                  className="text-xs font-semibold text-slate-700 border-slate-300"
                >
                  <Activity className="w-3.5 h-3.5 mr-1 text-royal-600" />
                  Refresh
                </Button>

                <Button
                  size="sm"
                  onClick={handleExportExcel}
                  isLoading={isExporting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export to Excel (.xlsx)
                </Button>
              </div>
            </div>
          </Card>

          {/* Analytics Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total OP Bookings</span>
              <div className="text-2xl font-black text-royal-600">
                {opAnalytics?.summary?.totalAppointments ?? opAnalytics?.summary?.totalOpCount ?? 0}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-500">Online OP</span>
              <div className="text-2xl font-black text-blue-600">
                {opAnalytics?.summary?.onlineAppointments ?? opAnalytics?.summary?.onlineBookingCount ?? 0}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-500">Offline Walk-ins</span>
              <div className="text-2xl font-black text-amber-600">
                {opAnalytics?.summary?.offlineAppointments ?? opAnalytics?.summary?.offlineBookingCount ?? 0}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-500">Completed OP</span>
              <div className="text-2xl font-black text-emerald-600">
                {opAnalytics?.summary?.completedAppointments ?? opAnalytics?.summary?.completedCount ?? 0}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-500">Confirmed / In Queue</span>
              <div className="text-2xl font-black text-indigo-600">
                {opAnalytics?.summary?.confirmedAppointments ?? 0}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Revenue Computed</span>
              <div className="text-2xl font-black text-slate-900">
                ₹{(opAnalytics?.summary?.totalRevenue ?? 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Hierarchical Breakdown Table: Hospital -> Doctors */}
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-royal-600" />
                  Hierarchical Hospital → Doctor OPD Breakdown
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any hospital row to expand and view doctor-wise OP counts, channels, and completion rates
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {(opAnalytics?.hospitals || opAnalytics?.hierarchical || []).length} Facilities
              </Badge>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 w-10"></th>
                    <th className="px-5 py-3">Hospital Name</th>
                    <th className="px-5 py-3 text-center">Total OP</th>
                    <th className="px-5 py-3 text-center">Online</th>
                    <th className="px-5 py-3 text-center">Offline Walk-in</th>
                    <th className="px-5 py-3 text-center">Completed</th>
                    <th className="px-5 py-3 text-right">Consultation Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {analyticsLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        Computing real-time OP metrics from live database...
                      </td>
                    </tr>
                  ) : (opAnalytics?.hospitals || opAnalytics?.hierarchical || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        No appointments found matching the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    (opAnalytics?.hospitals || opAnalytics?.hierarchical || []).map((hosp: any) => {
                      const isExpanded = !!expandedHospitals[hosp.id];
                      return (
                        <React.Fragment key={hosp.id}>
                          {/* Hospital Level Row */}
                          <tr
                            onClick={() =>
                              setExpandedHospitals((prev) => ({
                                ...prev,
                                [hosp.id]: !prev[hosp.id],
                              }))
                            }
                            className="hover:bg-royal-50/50 cursor-pointer font-semibold transition-colors bg-white"
                          >
                            <td className="px-5 py-3.5 text-center text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-royal-600 inline" />
                              ) : (
                                <ChevronRight className="w-4 h-4 inline" />
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900 text-sm">{hosp.name || hosp.hospitalName}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                Code: {hosp.code || hosp.hospitalCode} {hosp.city ? `• ${hosp.city}, ${hosp.state}` : ''}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-center font-bold text-royal-700 text-sm">
                              {hosp.totalAppointments ?? hosp.totalOp ?? 0}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full text-[11px]">
                                {hosp.onlineAppointments ?? hosp.onlineOp ?? 0}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full text-[11px]">
                                {hosp.offlineAppointments ?? hosp.offlineOp ?? 0}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-[11px]">
                                {hosp.completedAppointments ?? hosp.completedOp ?? 0}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-black text-slate-900">
                              ₹{(hosp.totalRevenue ?? 0).toLocaleString('en-IN')}
                            </td>
                          </tr>

                          {/* Expanded Doctors Breakdown */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="p-0 bg-slate-50/70 border-y border-slate-200">
                                <div className="p-4 sm:px-8 space-y-2">
                                  <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                                    Doctor Performance Breakdown ({hosp.name || hosp.hospitalName})
                                  </div>
                                  {(hosp.doctors || []).length === 0 ? (
                                    <div className="text-xs text-slate-400 py-3">
                                      No doctors recorded with appointments under this filter.
                                    </div>
                                  ) : (
                                    <table className="w-full text-xs text-left bg-white rounded-xl border border-slate-200 overflow-hidden">
                                      <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px] border-b border-slate-200">
                                        <tr>
                                          <th className="px-4 py-2.5">Doctor</th>
                                          <th className="px-4 py-2.5">Department</th>
                                          <th className="px-4 py-2.5 text-center">Total OP</th>
                                          <th className="px-4 py-2.5 text-center">Online</th>
                                          <th className="px-4 py-2.5 text-center">Offline</th>
                                          <th className="px-4 py-2.5 text-center">Completed</th>
                                          <th className="px-4 py-2.5 text-right">Fee Rate</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {hosp.doctors.map((doc: any) => (
                                          <tr key={doc.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-2.5 font-bold text-slate-800">
                                              Dr. {doc.name || doc.doctorName}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-500">
                                              {doc.department || doc.specialization}
                                            </td>
                                            <td className="px-4 py-2.5 text-center font-bold text-royal-600">
                                              {doc.totalAppointments ?? doc.totalOp ?? 0}
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-blue-600 font-semibold">
                                              {doc.onlineAppointments ?? doc.onlineOp ?? 0}
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-amber-600 font-semibold">
                                              {doc.offlineAppointments ?? doc.offlineOp ?? 0}
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-emerald-600 font-semibold">
                                              {doc.completedAppointments ?? doc.completedOp ?? 0}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                                              ₹{doc.consultationFee || 0}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: DIAGNOSTIC LABS ACCREDITATION & APPROVALS */}
      {activeTab === 'labs' && (
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-purple-600" />
                Diagnostic Laboratories Accreditation Oversight
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and approve independent laboratory networks seeking platform diagnostic authorization
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setLabStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    labStatusFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({labsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLabStatusFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    labStatusFilter === 'PENDING'
                      ? 'bg-white text-amber-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pending ({pendingLabsCount})
                  {pendingLabsCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLabStatusFilter('APPROVED')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    labStatusFilter === 'APPROVED'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Accredited ({approvedLabsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setLabStatusFilter('REJECTED')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    labStatusFilter === 'REJECTED'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rejected ({rejectedLabsCount})
                </button>
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchLabs()}
                disabled={labsFetching}
                className="text-xs"
                title="Refresh Laboratories"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${labsFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>

          {/* Search Bar */}
          <div className="p-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search labs by name, city, license..."
                value={labSearchQuery}
                onChange={(e) => setLabSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            {labSearchQuery && (
              <button
                type="button"
                onClick={() => setLabSearchQuery('')}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Clear Search
              </button>
            )}
            <div className="text-[11px] text-slate-400 font-medium">
              Showing {filteredLabs.length} of {labsList.length} laboratories
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Laboratory Name</th>
                  <th className="px-5 py-3">License & Accreditation</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {labsLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Loading diagnostic laboratories...
                    </td>
                  </tr>
                ) : filteredLabs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      {labSearchQuery
                        ? `No laboratories matching "${labSearchQuery}"`
                        : labStatusFilter === 'PENDING'
                        ? 'No pending diagnostic laboratory applications awaiting approval.'
                        : 'No laboratories found matching the selected filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredLabs.map((lab: any) => {
                    const isPending = lab.status === 'PENDING';
                    const isApproved = lab.status === 'APPROVED' || lab.status === 'ACTIVE';
                    const isRejected = lab.status === 'REJECTED';

                    return (
                      <tr key={lab.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{lab.name}</div>
                          <div className="text-[11px] text-slate-400">
                            Applied: {new Date(lab.createdAt).toLocaleDateString()}
                          </div>
                          {lab.hospital && (
                            <div className="text-[11px] text-royal-600 font-medium">
                              Linked: {lab.hospital.name} ({lab.hospital.code})
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600">
                          {lab.licenseNumber || 'Under Review'}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant={lab.type === 'INDEPENDENT' ? 'primary' : 'outline'}
                            className="text-[10px]"
                          >
                            {lab.type}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-800">{lab.email}</div>
                          <div className="text-slate-400 text-[11px]">{lab.phone}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {lab.city || '—'}, {lab.state || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Accredited
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Pending Review
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                              <X className="w-3.5 h-3.5 text-rose-600" />
                              Rejected
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {lab.status}
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                onClick={() => approveLabMutation.mutate(lab.id)}
                                isLoading={approveLabMutation.isPending}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                                onClick={() => setRejectingLab(lab)}
                              >
                                <X className="w-3.5 h-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          {isApproved && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                              onClick={() => setRejectingLab(lab)}
                            >
                              Revoke / Reject
                            </Button>
                          )}
                          {isRejected && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                              onClick={() => approveLabMutation.mutate(lab.id)}
                              isLoading={approveLabMutation.isPending}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Re-Approve
                            </Button>
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

      {/* ONBOARD HOSPITAL MODAL */}
      {isAddHospitalOpen && (
        <Modal
          isOpen={isAddHospitalOpen}
          onClose={() => setIsAddHospitalOpen(false)}
          title="Onboard New Hospital Facility"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateHospital} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hospital Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newHospital.name}
                  onChange={(e) => setNewHospital({ ...newHospital, name: e.target.value })}
                  placeholder="e.g. Manipal Hospital Whitefield"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-royal-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Unique Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newHospital.code}
                  onChange={(e) => setNewHospital({ ...newHospital, code: e.target.value })}
                  placeholder="e.g. MANI"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  City <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newHospital.city}
                  onChange={(e) => setNewHospital({ ...newHospital, city: e.target.value })}
                  placeholder="Bengaluru"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  State <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newHospital.state}
                  onChange={(e) => setNewHospital({ ...newHospital, state: e.target.value })}
                  placeholder="Karnataka"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pincode <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newHospital.pincode}
                  onChange={(e) => setNewHospital({ ...newHospital, pincode: e.target.value })}
                  placeholder="560066"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Physical Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newHospital.address}
                onChange={(e) => setNewHospital({ ...newHospital, address: e.target.value })}
                placeholder="143, 212-215, EPIP Zone, Whitefield"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newHospital.phone}
                  onChange={(e) => setNewHospital({ ...newHospital, phone: e.target.value })}
                  placeholder="+91 80 2502 4444"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emergency Hotline</label>
                <input
                  type="text"
                  value={newHospital.emergencyPhone}
                  onChange={(e) => setNewHospital({ ...newHospital, emergencyPhone: e.target.value })}
                  placeholder="1066 / 108"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={newHospital.email}
                  onChange={(e) => setNewHospital({ ...newHospital, email: e.target.value })}
                  placeholder="contact@manipal.org"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Accredited Facilities & Amenities (comma-separated)
              </label>
              <input
                type="text"
                value={newHospital.facilities}
                onChange={(e) => setNewHospital({ ...newHospital, facilities: e.target.value })}
                placeholder="24/7 Emergency, Cath Lab, MRI 3T, Level 3 Trauma, Pharmacy"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">About Facility</label>
              <textarea
                rows={2}
                value={newHospital.about}
                onChange={(e) => setNewHospital({ ...newHospital, about: e.target.value })}
                placeholder="Brief description of the tertiary care hospital facility..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="emergencyAvail"
                checked={newHospital.isEmergencyAvailable}
                onChange={(e) => setNewHospital({ ...newHospital, isEmergencyAvailable: e.target.checked })}
                className="w-4 h-4 text-royal-600 rounded"
              />
              <label htmlFor="emergencyAvail" className="font-semibold text-slate-800">
                24/7 Emergency & Critical Care Department Available
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddHospitalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-royal-600 hover:bg-royal-700 font-bold"
                disabled={createHospitalMutation.isPending}
              >
                {createHospitalMutation.isPending ? 'Onboarding...' : 'Onboard Hospital'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* PROVISION HOSPITAL ADMIN MODAL */}
      {provisionAdminHospital && (
        <Modal
          isOpen={!!provisionAdminHospital}
          onClose={() => setProvisionAdminHospital(null)}
          title={`Assign Administrator: ${provisionAdminHospital.name}`}
          maxWidth="sm"
        >
          <form onSubmit={handleProvisionAdmin} className="space-y-4 text-xs">
            <p className="text-slate-500">
              Create an administrative user login for this hospital facility. This account will have full access to manage OPD queues, schedules, doctors, and appointment workflows.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Admin Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Hospital Admin"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Admin Login Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@hospital.org"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Password@123"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setProvisionAdminHospital(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-royal-600 hover:bg-royal-700 font-bold"
                disabled={provisionAdminMutation.isPending}
              >
                {provisionAdminMutation.isPending ? 'Provisioning...' : 'Provision Admin'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reject Hospital Application Modal */}
      {isRejectModalOpen && selectedRejectHospital && (
        <Modal
          isOpen={isRejectModalOpen}
          onClose={() => {
            setIsRejectModalOpen(false);
            setSelectedRejectHospital(null);
          }}
          title="Reject Hospital Accreditation"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              You are about to reject the accreditation application for{' '}
              <strong className="text-slate-900">{selectedRejectHospital.name}</strong>.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Rejection Reason (Recorded in audit logs)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="State the reason for rejecting this hospital application..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setSelectedRejectHospital(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={() => {
                  rejectHospitalMutation.mutate({
                    id: selectedRejectHospital.id,
                    reason: rejectReason,
                  });
                }}
                isLoading={rejectHospitalMutation.isPending}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Diagnostic Lab Application Modal */}
      {rejectingLab && (
        <Modal
          isOpen={!!rejectingLab}
          onClose={() => setRejectingLab(null)}
          title="Reject Diagnostic Lab Accreditation"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              You are about to reject the accreditation application for{' '}
              <strong className="text-slate-900">{rejectingLab.name}</strong>.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Rejection Reason (Recorded in platform audit logs)
              </label>
              <textarea
                value={labRejectReason}
                onChange={(e) => setLabRejectReason(e.target.value)}
                rows={3}
                placeholder="State the reason for rejecting this diagnostic laboratory..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectingLab(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={() => {
                  rejectLabMutation.mutate({
                    id: rejectingLab.id,
                    reason: labRejectReason || undefined,
                  });
                }}
                isLoading={rejectLabMutation.isPending}
              >
                Confirm Lab Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
