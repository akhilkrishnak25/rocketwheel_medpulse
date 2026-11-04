import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical,
  Activity,
  Search,
  CheckCircle2,
  Clock,
  User,
  Filter,
  Check,
  Calendar,
  AlertCircle,
  LogOut,
  FileText,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  ExternalLink,
  Plus,
  Trash2,
  Edit,
  DollarSign,
  X,
  Tag,
  ToggleLeft,
  ToggleRight,
  Building2,
  Users,
  Settings,
  Eye,
  EyeOff,
  RotateCcw,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { labApi } from '../api/lab.api';
import { uploadApi, getMediaUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { InlineSpinner } from '../components/ui/Loading';
import { LabTestRequest } from '../types';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const LabTechnicianDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, logout } = useAuth();

  // Primary Tab: 'hospital' | 'direct' | 'all' | 'tests' | 'settings'
  const [activeMainTab, setActiveMainTab] = useState<'hospital' | 'direct' | 'all' | 'tests' | 'settings'>('hospital');

  // Unified Requisitions & Booking Filters
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'HOSPITAL' | 'DIRECT_PATIENT'>('HOSPITAL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [testNameFilter, setTestNameFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<LabTestRequest | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [viewingReportRequest, setViewingReportRequest] = useState<LabTestRequest | null>(null);

  // Submit Report Form State (PDF Document Upload - Requirement 19)
  const [reportPdfFile, setReportPdfFile] = useState<File | null>(null);
  const [reportFileUrl, setReportFileUrl] = useState('');
  const [reportFileName, setReportFileName] = useState('');
  const [reportFileSize, setReportFileSize] = useState<number | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [reportRemarks, setReportRemarks] = useState('');

  const resetReportForm = () => {
    setIsReportModalOpen(false);
    setSelectedRequest(null);
    setReportPdfFile(null);
    setReportFileUrl('');
    setReportFileName('');
    setReportFileSize(null);
    setIsUploadingPdf(false);
    setUploadProgressText('');
    setReportRemarks('');
  };

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Invalid File Type', 'Please upload a PDF document (.pdf) only.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File Exceeds Limit', 'Maximum allowed file size is 10MB.');
      return;
    }

    setReportPdfFile(file);
    setIsUploadingPdf(true);
    setUploadProgressText('Processing PDF document...');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          setUploadProgressText('Uploading to secure medical report storage...');
          const result = await uploadApi.uploadReportPdf(file.name, base64Data);
          setReportFileUrl(result.url);
          setReportFileName(result.fileName || file.name);
          setReportFileSize(file.size);
          toast.success('PDF Uploaded', 'Official diagnostic report uploaded successfully.');
        } catch (err: any) {
          toast.error('Upload Failed', err.message || 'Could not upload PDF report');
          setReportPdfFile(null);
          setReportFileUrl('');
        } finally {
          setIsUploadingPdf(false);
          setUploadProgressText('');
        }
      };
      reader.onerror = () => {
        toast.error('Upload Failed', 'Error reading selected PDF file');
        setIsUploadingPdf(false);
        setUploadProgressText('');
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error('Upload Failed', err.message || 'Error processing file');
      setIsUploadingPdf(false);
      setUploadProgressText('');
    }
  };

  // Test Catalog States
  const [testCategoryFilter, setTestCategoryFilter] = useState('ALL');
  const [testSearch, setTestSearch] = useState('');
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<any | null>(null);

  // New Test Form State
  const [newTest, setNewTest] = useState({
    name: '',
    code: '',
    category: 'Biochemistry',
    description: '',
    department: '',
    tatHours: 24,
    price: 500,
  });

  // Bulk Import & Export States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);

  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [exportCategory, setExportCategory] = useState<string>('ALL');
  const [exportDepartment, setExportDepartment] = useState<string>('ALL');
  const [exportStatus, setExportStatus] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    try {
      toast.info('Downloading Template', `Preparing sample ${format.toUpperCase()} template...`);
      await labApi.downloadSampleTemplate(format);
      toast.success('Template Downloaded', `Sample lab tests ${format.toUpperCase()} template downloaded.`);
    } catch (err: any) {
      toast.error('Download Failed', err.message || 'Could not download template');
    }
  };

  const handleSelectImportFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast.error('Invalid Format', 'Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }

    setImportFile(file);
    setIsPreviewLoading(true);
    setPreviewData(null);
    setImportSummary(null);

    try {
      const data = await labApi.previewImportTests(file);
      setPreviewData(data);
      if (data.totalRows === 0) {
        toast.info('Empty File', 'The uploaded file does not contain any test records.');
      } else {
        toast.info(
          'File Analyzed',
          `Parsed ${data.totalRows} rows: ${data.validCount} valid, ${data.duplicateCount} duplicates, ${data.errorCount} invalid.`
        );
      }
    } catch (err: any) {
      toast.error('Analysis Failed', err.message || 'Failed to parse uploaded file');
      setImportFile(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData?.rows) return;
    const validRows = previewData.rows.filter((r: any) => r.isValid && !r.isDuplicate && !r.isExistingDuplicate);
    if (validRows.length === 0) {
      toast.info('No Valid Tests', 'There are no valid tests to import.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await labApi.importTests(validRows);
      setImportSummary(result.summary);
      toast.success('Import Successful', result.message || `Successfully imported ${result.summary?.imported || 0} tests.`);
      queryClient.invalidateQueries({ queryKey: ['technician-lab-tests'] });
    } catch (err: any) {
      toast.error('Import Failed', err.message || 'Failed to import lab tests into catalog');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      toast.info('Exporting Catalog', `Generating ${exportFormat.toUpperCase()} file...`);
      await labApi.exportTests({
        format: exportFormat,
        category: exportCategory === 'ALL' ? undefined : exportCategory,
        department: exportDepartment === 'ALL' ? undefined : exportDepartment,
        status: exportStatus === 'ALL' ? undefined : exportStatus,
      });
      toast.success('Export Complete', 'Laboratory tests exported successfully.');
      setIsExportModalOpen(false);
    } catch (err: any) {
      toast.error('Export Failed', err.message || 'Failed to export laboratory tests');
    } finally {
      setIsExporting(false);
    }
  };

  const effectiveSource =
    activeMainTab === 'hospital'
      ? 'HOSPITAL'
      : activeMainTab === 'direct'
      ? 'DIRECT_PATIENT'
      : sourceFilter;

  // Summary KPI Metrics Query
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['lab-stats'],
    queryFn: () => labApi.getStats(),
    refetchInterval: 12000,
  });

  // Lab Settings & Price Visibility Query
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['lab-settings'],
    queryFn: () => labApi.getSettings(),
  });

  // Toggle Price Visibility to Direct Patients Mutation (Requirement 1)
  const updatePriceVisibilityMutation = useMutation({
    mutationFn: (showPrices: boolean) => labApi.updatePriceVisibility(showPrices),
    onSuccess: (_, vars) => {
      toast.success(
        'Price Visibility Updated',
        vars
          ? 'Diagnostic test prices are now visible to patients on direct booking.'
          : 'Diagnostic test prices are now hidden from patients on direct booking.'
      );
      queryClient.invalidateQueries({ queryKey: ['lab-settings'] });
      queryClient.invalidateQueries({ queryKey: ['public-lab-tests'] });
    },
    onError: (err: any) => {
      toast.error('Failed to update price visibility', err.message);
    },
  });

  // Fetch lab requests with unified server-side filters
  const { data: requests = [], isLoading: isRequestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['lab-requests', effectiveSource, statusFilter, searchQuery, testNameFilter, startDate, endDate],
    queryFn: () =>
      labApi.getRequests({
        source: effectiveSource === 'ALL' ? undefined : effectiveSource,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
        testName: testNameFilter.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    refetchInterval: 10000,
    enabled: ['hospital', 'direct', 'all'].includes(activeMainTab),
  });

  // Immediate popup/toast notifications when new lab requests arrive
  const prevReqIdsRef = useRef<Set<string>>(new Set());
  const isInitialReqMount = useRef(true);

  useEffect(() => {
    if (!requests || !Array.isArray(requests)) return;
    if (isInitialReqMount.current) {
      prevReqIdsRef.current = new Set(requests.map((r: any) => r.id));
      isInitialReqMount.current = false;
      return;
    }

    for (const req of requests) {
      if (!prevReqIdsRef.current.has(req.id)) {
        prevReqIdsRef.current.add(req.id);
        toast.info(
          'New Lab Request Received',
          `Requisition #${req.requestNumber} for ${req.patient?.fullName || 'Patient'}`
        );
      }
    }
  }, [requests, toast]);

  // Fetch lab tests catalog
  const { data: labTests = [], isLoading: isTestsLoading, refetch: refetchLabTests } = useQuery({
    queryKey: ['technician-lab-tests', testCategoryFilter, testSearch],
    queryFn: () => labApi.getTests(testCategoryFilter === 'ALL' ? undefined : testCategoryFilter, testSearch || undefined),
    enabled: activeMainTab === 'tests',
  });

  // Status & payment update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, paymentStatus }: { id: string; status: string; paymentStatus?: string }) =>
      labApi.updateStatus(id, status, paymentStatus),
    onSuccess: (_, vars) => {
      toast.success('Status Updated', `Test requisition status set to ${vars.status}`);
      queryClient.invalidateQueries({ queryKey: ['lab-requests'] });
      queryClient.invalidateQueries({ queryKey: ['lab-stats'] });
    },
    onError: (err: any) => {
      toast.error('Status Update Failed', err.message);
    },
  });

  // Submit report mutation
  const submitReportMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => labApi.submitReport(id, data),
    onSuccess: () => {
      toast.success('Lab Report Published', 'Diagnostic report saved and dispatched to patient and requesting hospital');
      resetReportForm();
      queryClient.invalidateQueries({ queryKey: ['lab-requests'] });
      queryClient.invalidateQueries({ queryKey: ['lab-stats'] });
    },
    onError: (err: any) => {
      toast.error('Submission Failed', err.message);
    },
  });

  // Catalog CRUD mutations
  const createTestMutation = useMutation({
    mutationFn: (data: any) => labApi.createTest(data),
    onSuccess: () => {
      toast.success('Test Created', 'Diagnostic test added to laboratory catalog');
      setIsAddTestOpen(false);
      setNewTest({ name: '', code: '', category: 'Biochemistry', description: '', department: '', tatHours: 24, price: 500 });
      queryClient.invalidateQueries({ queryKey: ['technician-lab-tests'] });
    },
    onError: (err: any) => {
      toast.error('Create Failed', err.message);
    },
  });

  const updateTestMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => labApi.updateTest(id, data),
    onSuccess: () => {
      toast.success('Test Updated', 'Diagnostic test details and pricing updated');
      setEditingTest(null);
      queryClient.invalidateQueries({ queryKey: ['technician-lab-tests'] });
    },
    onError: (err: any) => {
      toast.error('Update Failed', err.message);
    },
  });

  const toggleTestMutation = useMutation({
    mutationFn: (testId: string) => labApi.toggleTest(testId),
    onSuccess: (data: any) => {
      toast.success('Availability Updated', data.message || 'Test availability toggled');
      queryClient.invalidateQueries({ queryKey: ['technician-lab-tests'] });
    },
    onError: (err: any) => {
      toast.error('Toggle Failed', err.message);
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: (testId: string) => labApi.deleteTest(testId),
    onSuccess: () => {
      toast.success('Test Removed', 'Test deleted from laboratory catalog');
      queryClient.invalidateQueries({ queryKey: ['technician-lab-tests'] });
    },
    onError: (err: any) => {
      toast.error('Delete Failed', err.message);
    },
  });

  const filteredRequests = (requests || []).filter((req: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      req.requestNumber?.toLowerCase().includes(q) ||
      req.patient?.fullName?.toLowerCase().includes(q) ||
      req.patient?.patientIdNumber?.toLowerCase().includes(q) ||
      req.doctor?.name?.toLowerCase().includes(q)
    );
  });

  const categories = [
    'ALL',
    'Hematology',
    'Biochemistry',
    'Clinical Pathology',
    'Microbiology',
    'Serology',
    'Radiology',
    'Endocrinology',
    'Diabetes Care',
    'Specialized Immunology',
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-slate-900 text-white px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <RocketWheelLogo size="sm" />
          <div className="border-l border-slate-700 pl-3">
            <span className="text-xs font-bold text-purple-400 block tracking-wider uppercase">
              Lab Admin & Pathology Operations Portal
            </span>
            <span className="text-sm font-extrabold text-white">
              {settings?.name || user?.lab?.name || user?.hospital?.name || 'Diagnostic Laboratory'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Price Visibility Quick Indicator (Requirement 1) */}
          <div
            onClick={() => setActiveMainTab('settings')}
            className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition"
            title="Click to configure patient price visibility"
          >
            <span className="text-[11px] text-slate-400">Patient Prices:</span>
            {settings?.showPrices ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <Eye className="w-3.5 h-3.5" /> Visible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                <EyeOff className="w-3.5 h-3.5" /> Hidden
              </span>
            )}
          </div>

          <div className="hidden sm:block text-right">
            <div className="font-bold text-slate-200">{user?.name}</div>
            <div className="text-[11px] text-purple-400 font-mono">
              License: {settings?.licenseNumber || user?.lab?.licenseNumber || 'ACCREDITED'}
            </div>
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
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {/* Tab 1: Hospital-Sent Tests */}
            <button
              onClick={() => {
                setActiveMainTab('hospital');
                setSourceFilter('HOSPITAL');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeMainTab === 'hospital'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Hospital-Sent Tests
              {(stats?.pendingHospitalRequests || 0) > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {stats?.pendingHospitalRequests} pending
                </span>
              )}
            </button>

            {/* Tab 2: Direct Patient Bookings */}
            <button
              onClick={() => {
                setActiveMainTab('direct');
                setSourceFilter('DIRECT_PATIENT');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeMainTab === 'direct'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Direct Patient Bookings ({stats?.directPatientBookings || 0})
            </button>

            {/* Tab 3: Unified Queue */}
            <button
              onClick={() => {
                setActiveMainTab('all');
                setSourceFilter('ALL');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeMainTab === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              Unified Queue
            </button>

            {/* Tab 4: Lab Tests & Pricing */}
            <button
              onClick={() => setActiveMainTab('tests')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeMainTab === 'tests'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Tag className="w-4 h-4" />
              Lab Tests & Pricing ({(labTests || []).length})
            </button>

            {/* Tab 5: Settings & Price Visibility */}
            <button
              onClick={() => setActiveMainTab('settings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeMainTab === 'settings'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings & Price Visibility
            </button>
          </div>
        </div>

        {/* 3. DASHBOARD SUMMARY CARDS (Requirement 3) */}
        {['hospital', 'direct', 'all'].includes(activeMainTab) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Card 1: Total Hospital Test Requests */}
            <Card
              onClick={() => {
                setActiveMainTab('hospital');
                setSourceFilter('HOSPITAL');
                setStatusFilter('ALL');
              }}
              className="p-4 rounded-2xl border-slate-200 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hospital Requests</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">{stats?.totalHospitalRequests ?? 0}</div>
              <span className="text-[10px] text-blue-600 font-semibold">From OPD & Wards</span>
            </Card>

            {/* Card 2: Pending Hospital Requests */}
            <Card
              onClick={() => {
                setActiveMainTab('hospital');
                setSourceFilter('HOSPITAL');
                setStatusFilter('REQUESTED');
              }}
              className="p-4 rounded-2xl border-slate-200 bg-white hover:border-amber-400 hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Hospital</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-700">{stats?.pendingHospitalRequests ?? 0}</div>
              <span className="text-[10px] text-amber-600 font-semibold">Requires acceptance</span>
            </Card>

            {/* Card 3: Direct Patient Bookings */}
            <Card
              onClick={() => {
                setActiveMainTab('direct');
                setSourceFilter('DIRECT_PATIENT');
                setStatusFilter('ALL');
              }}
              className="p-4 rounded-2xl border-slate-200 bg-white hover:border-purple-400 hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Direct Bookings</span>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-900">{stats?.directPatientBookings ?? 0}</div>
              <span className="text-[10px] text-purple-600 font-semibold">Online Patient Portal</span>
            </Card>

            {/* Card 4: Today's Bookings */}
            <Card
              onClick={() => {
                const todayStr = new Date().toISOString().split('T')[0];
                setStartDate(todayStr);
                setEndDate(todayStr);
              }}
              className="p-4 rounded-2xl border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today's Bookings</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-700">{stats?.todayBookings ?? 0}</div>
              <span className="text-[10px] text-emerald-600 font-semibold">Received Today</span>
            </Card>

            {/* Card 5: Tests In Progress */}
            <Card
              onClick={() => {
                setStatusFilter('PROCESSING');
              }}
              className="p-4 rounded-2xl border-slate-200 bg-white hover:border-cyan-400 hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In Progress</span>
                <div className="p-2 bg-cyan-50 text-cyan-600 rounded-xl">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-cyan-700">{stats?.testsInProgress ?? 0}</div>
              <span className="text-[10px] text-cyan-600 font-semibold">Sampling & Analysis</span>
            </Card>

            {/* Card 6: Completed Tests */}
            <Card
              onClick={() => {
                setStatusFilter('COMPLETED');
              }}
              className="p-4 rounded-2xl border-slate-200 bg-white hover:border-teal-400 hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed Tests</span>
                <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-teal-700">{stats?.completedTests ?? 0}</div>
              <span className="text-[10px] text-teal-600 font-semibold">Reports Delivered</span>
            </Card>
          </div>
        )}

        {/* ======================================================== */}
        {/* TABS 1, 2, 3: HOSPITAL-SENT, DIRECT, AND UNIFIED REQUISITIONS */}
        {/* ======================================================== */}
        {['hospital', 'direct', 'all'].includes(activeMainTab) && (
          <div className="space-y-6">
            {/* Title & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  {activeMainTab === 'hospital' ? (
                    <>
                      <Building2 className="w-6 h-6 text-blue-600" />
                      Hospital-Sent Diagnostic Test Requests
                    </>
                  ) : activeMainTab === 'direct' ? (
                    <>
                      <Users className="w-6 h-6 text-purple-600" />
                      Direct Patient Online Bookings
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-6 h-6 text-purple-600" />
                      Unified Diagnostic Test Queue
                    </>
                  )}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeMainTab === 'hospital'
                    ? 'Manage clinical diagnostic test orders received from hospital doctors, OPDs, and in-patient wards'
                    : activeMainTab === 'direct'
                    ? 'Manage self-scheduled lab appointments placed directly by patients through the MedPulse platform'
                    : 'Manage both hospital-sent lab requests and direct patient online bookings in a unified workspace'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { refetchRequests(); refetchStats(); }} className="text-xs shrink-0">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </div>

            {/* 4. FILTERS AND SEARCH (Requirement 4) */}
            <Card className="p-4 rounded-2xl border-slate-200 bg-white shadow-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                {/* Source Filter (when in Unified view) */}
                {activeMainTab === 'all' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Booking Source</label>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="ALL">All Sources</option>
                      <option value="HOSPITAL">Hospital-Sent Tests</option>
                      <option value="DIRECT_PATIENT">Direct Patient Bookings</option>
                    </select>
                  </div>
                )}

                {/* Status Filter */}
                <div className={activeMainTab === 'all' ? '' : 'sm:col-span-1'}>
                  <label className="block font-semibold text-slate-700 mb-1">Test Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="REQUESTED">Pending / Requested</option>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="SAMPLE_COLLECTED">Sample Collected</option>
                    <option value="PROCESSING">Processing / Testing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled / Rejected</option>
                  </select>
                </div>

                {/* Search Patient or Booking ID */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Search Patient or Booking ID</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Requisition #, patient name, MRN, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Filter by Test Name */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Filter by Test Name</label>
                  <input
                    type="text"
                    placeholder="e.g. CBC, Lipid, Thyroid..."
                    value={testNameFilter}
                    onChange={(e) => setTestNameFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Date Range */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date Range</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl border border-slate-200 text-[11px] bg-white font-medium"
                    />
                    <span className="text-slate-400 text-xs">to</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl border border-slate-200 text-[11px] bg-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Clear Active Filters */}
              {(statusFilter !== 'ALL' || searchQuery || testNameFilter || startDate || endDate || (activeMainTab === 'all' && sourceFilter !== 'ALL')) && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 text-[11px]">Active filters applied</span>
                  <button
                    onClick={() => {
                      setStatusFilter('ALL');
                      setSearchQuery('');
                      setTestNameFilter('');
                      setStartDate('');
                      setEndDate('');
                      if (activeMainTab === 'all') setSourceFilter('ALL');
                    }}
                    className="text-purple-600 hover:text-purple-800 font-bold flex items-center gap-1 text-[11px]"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear All Filters
                  </button>
                </div>
              )}
            </Card>

            {/* 5. UNIFIED TEST MANAGEMENT TABLE (Requirement 5) */}
            <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Requisition / Source</th>
                      <th className="px-5 py-3.5">Patient Details</th>
                      <th className="px-5 py-3.5">Requested Tests</th>
                      <th className="px-5 py-3.5">Referral / Booking Info</th>
                      <th className="px-5 py-3.5">Pricing & Payment</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions & Delivery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {isRequestsLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <InlineSpinner size="md" />
                            <span>Loading diagnostic requisitions...</span>
                          </div>
                        </td>
                      </tr>
                    ) : requests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-600">No diagnostic requisitions found</p>
                            <p className="text-[11px] text-slate-400">
                              {activeMainTab === 'hospital'
                                ? 'No hospital-sent test requests match the current filters.'
                                : activeMainTab === 'direct'
                                ? 'No direct patient online bookings match the current filters.'
                                : 'No requisitions found in this view.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      requests.map((req: any) => {
                        const parsedTests = req.testsList || [];
                        const isHospital = req.bookingSource === 'HOSPITAL' || Boolean(req.doctorId || req.appointmentId);
                        const isPaid = req.paymentStatus === 'PAID' || req.paymentStatus === 'COMPLETED';

                        return (
                          <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Requisition Number & Source Badge */}
                            <td className="px-5 py-3.5 align-top">
                              <span className="font-mono font-bold text-purple-700 block text-xs">
                                {req.requestNumber}
                              </span>
                              <div className="mt-1">
                                {isHospital ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    <Building2 className="w-2.5 h-2.5" /> Hospital-Sent
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                    <Users className="w-2.5 h-2.5" /> Direct Patient
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-1">
                                {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>

                            {/* Patient Details */}
                            <td className="px-5 py-3.5 align-top">
                              <div className="font-bold text-slate-900 text-xs">{req.patient?.fullName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                MRN: {req.patient?.patientIdNumber || 'OPD'}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                +91 {req.patient?.mobileNumber}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {req.patient?.gender || 'N/A'} {req.patient?.age ? `• ${req.patient.age} Yrs` : ''}
                              </div>
                              {req.patient?.address && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[160px]" title={req.patient.address}>
                                  {req.patient.address}
                                </div>
                              )}
                            </td>

                            {/* Ordered Tests (Multiple tests supported) */}
                            <td className="px-5 py-3.5 align-top">
                              <div className="space-y-1.5 max-w-xs">
                                {parsedTests.map((t: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-800 flex items-center justify-between"
                                  >
                                    <div className="truncate pr-1">
                                      <span>• {t.name}</span>
                                      {t.code && <span className="text-[9px] text-slate-400 font-mono block">Code: {t.code}</span>}
                                    </div>
                                    {t.price !== undefined && (
                                      <span className="text-purple-700 font-bold font-mono text-[10px] shrink-0">
                                        ₹{t.price}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {req.clinicalNotes && (
                                  <div className="text-[10px] text-slate-500 italic bg-amber-50/50 p-1.5 rounded-lg border border-amber-100">
                                    Notes: "{req.clinicalNotes}"
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Referral / Booking Details */}
                            <td className="px-5 py-3.5 align-top">
                              {isHospital ? (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-slate-900 text-xs flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    {req.doctor?.name || 'Hospital Doctor'}
                                  </div>
                                  <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-slate-400" />
                                    {req.hospital?.name || 'Affiliated Hospital'}
                                  </div>
                                  {req.doctor?.specialization && (
                                    <div className="text-[10px] text-slate-400">{req.doctor.specialization}</div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-purple-900 text-xs">Direct Patient Booking</div>
                                  <div className="text-[11px] text-slate-500">
                                    Appointment: {req.preferredDate ? new Date(req.preferredDate).toLocaleDateString() : 'Next Available'}
                                  </div>
                                  <div className="text-[10px] text-slate-400">Specimen Collection / Walk-in</div>
                                </div>
                              )}
                            </td>

                            {/* Pricing & Payment Information */}
                            <td className="px-5 py-3.5 align-top">
                              <div className="space-y-1">
                                <div className="text-sm font-black text-slate-900 font-mono">
                                  ₹{req.totalAmount || 0}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isPaid
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {isPaid ? 'PAID' : 'PAYMENT PENDING'}
                                  </span>
                                  {!isPaid && (
                                    <button
                                      type="button"
                                      onClick={() => updateStatusMutation.mutate({ id: req.id, status: req.status, paymentStatus: 'PAID' })}
                                      className="text-[10px] text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                                      title="Mark payment as received at center counter"
                                    >
                                      Mark Paid
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Status Tracking */}
                            <td className="px-5 py-3.5 align-top">
                              <Badge
                                variant={
                                  req.status === 'COMPLETED'
                                    ? 'success'
                                    : req.status === 'PROCESSING'
                                    ? 'purple'
                                    : req.status === 'SAMPLE_COLLECTED'
                                    ? 'royal'
                                    : req.status === 'ACCEPTED' || req.status === 'RECEIVED'
                                    ? 'info'
                                    : req.status === 'CANCELLED' || req.status === 'REJECTED'
                                    ? 'danger'
                                    : 'warning'
                                }
                                className="text-[10px] font-bold"
                              >
                                {req.status === 'REQUESTED' ? 'PENDING' : req.status}
                              </Badge>

                              {req.priority === 'URGENT' && (
                                <Badge variant="danger" className="text-[9px] block mt-1 w-fit">
                                  URGENT
                                </Badge>
                              )}
                            </td>

                            {/* Actions & Report Upload / Delivery Options */}
                            <td className="px-5 py-3.5 text-right align-top space-y-1.5">
                              {/* 1. PENDING / REQUESTED: Accept or Reject */}
                              {(req.status === 'REQUESTED' || req.status === 'PENDING') && (
                                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                    onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'ACCEPTED' })}
                                    isLoading={updateStatusMutation.isPending}
                                  >
                                    <Check className="w-3.5 h-3.5 mr-1" /> Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-rose-600 border-rose-300 hover:bg-rose-50 font-bold text-xs"
                                    onClick={() => {
                                      if (window.confirm('Reject / Cancel this diagnostic test requisition?')) {
                                        updateStatusMutation.mutate({ id: req.id, status: 'CANCELLED' });
                                      }
                                    }}
                                    isLoading={updateStatusMutation.isPending}
                                  >
                                    <X className="w-3.5 h-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              )}

                              {/* 2. ACCEPTED: Sample Collected or Start Processing */}
                              {(req.status === 'ACCEPTED' || req.status === 'RECEIVED') && (
                                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-indigo-700 border-indigo-300 hover:bg-indigo-50 font-bold text-xs"
                                    onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'SAMPLE_COLLECTED' })}
                                    isLoading={updateStatusMutation.isPending}
                                  >
                                    Sample Collected
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                                    onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'PROCESSING' })}
                                    isLoading={updateStatusMutation.isPending}
                                  >
                                    Start Testing
                                  </Button>
                                </div>
                              )}

                              {/* 3. SAMPLE_COLLECTED: Start Processing */}
                              {req.status === 'SAMPLE_COLLECTED' && (
                                <Button
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                                  onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'PROCESSING' })}
                                  isLoading={updateStatusMutation.isPending}
                                >
                                  Start Processing
                                </Button>
                              )}

                              {/* 4. PROCESSING: Upload Report & Complete */}
                              {req.status === 'PROCESSING' && (
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setIsReportModalOpen(true);
                                  }}
                                >
                                  <Upload className="w-3.5 h-3.5 mr-1" /> Upload Report
                                </Button>
                              )}

                              {/* 5. COMPLETED: View Report & Delivery Status */}
                              {req.status === 'COMPLETED' && (
                                <div className="space-y-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs font-semibold"
                                    onClick={() => setViewingReportRequest(req)}
                                  >
                                    <FileText className="w-3.5 h-3.5 mr-1" /> View Report
                                  </Button>
                                  <div>
                                    {isHospital ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                        <Building2 className="w-3 h-3" /> Sent to Hospital
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                        <Check className="w-3 h-3" /> Available to Patient
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 6. CANCELLED / REJECTED */}
                              {(req.status === 'CANCELLED' || req.status === 'REJECTED') && (
                                <span className="text-rose-500 text-xs font-semibold">Cancelled</span>
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
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: LAB TESTS & PRICE MANAGEMENT (CRUD) */}
        {/* ======================================================== */}
        {activeMainTab === 'tests' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Tag className="w-6 h-6 text-purple-600" />
                  Diagnostic Test Catalog & Price Management
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define your diagnostic test menu, turnaround times, and fee schedules used across OPD consultations and patient direct bookings
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsImportModalOpen(true);
                    setImportFile(null);
                    setPreviewData(null);
                    setImportSummary(null);
                  }}
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-semibold"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Bulk Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExportModalOpen(true)}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export Tests
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsAddTestOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add New Test
                </Button>
                <Button variant="outline" size="sm" onClick={() => refetchLabTests()} className="text-xs">
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search test by name, code, or description..."
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="w-full sm:w-auto">
                <select
                  value={testCategoryFilter}
                  onChange={(e) => setTestCategoryFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'ALL' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isTestsLoading ? (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                  Loading test catalog...
                </div>
              ) : (labTests || []).length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  No tests found. Click 'Add New Test' to create one.
                </div>
              ) : (
                (labTests || []).map((t: any) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            {t.code || 'TEST'}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm mt-1">{t.name}</h3>
                        </div>
                        <Badge
                          variant={t.status === 'ACTIVE' ? 'success' : 'outline'}
                          className="text-[10px]"
                        >
                          {t.status}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-500 font-medium">
                        Category: <strong className="text-slate-800">{t.category || 'General'}</strong>
                      </div>

                      {t.description && (
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {t.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Turnaround: <strong>{t.tatHours ? `${t.tatHours} hours` : '24 hours'}</strong>
                        </span>
                        <span className="font-black text-slate-900 text-base">
                          ₹{t.price}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => toggleTestMutation.mutate(t.id)}
                      >
                        {t.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-purple-600 hover:bg-purple-50 text-xs"
                          onClick={() => setEditingTest(t)}
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 shadow-xs"
                          onClick={() => {
                            if (window.confirm(`Delete ${t.name} from catalog?`)) {
                              deleteTestMutation.mutate(t.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: LAB SETTINGS & PRICE VISIBILITY CONFIGURATION */}
        {/* ======================================================== */}
        {activeMainTab === 'settings' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Page Header */}
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Settings className="w-6 h-6 text-purple-600" />
                Laboratory Settings & Price Visibility
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure patient booking rules, test price transparency, and diagnostic facility credentials
              </p>
            </div>

            {/* Requirement 1: Show Price / Hide Price Option */}
            <Card className="rounded-3xl border-slate-200 shadow-sm p-6 sm:p-8 bg-white space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl shrink-0">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Patient Test Price Visibility</h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                      Control whether diagnostic test prices are publicly displayed to patients on the MedPulse direct lab booking portal.
                    </p>
                  </div>
                </div>

                {/* Toggle Button */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-bold ${settings?.showPrices ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {settings?.showPrices ? 'Show Prices (Enabled)' : 'Hide Prices (Disabled)'}
                  </span>
                  <button
                    type="button"
                    disabled={updatePriceVisibilityMutation.isPending}
                    onClick={() => updatePriceVisibilityMutation.mutate(!settings?.showPrices)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings?.showPrices ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        settings?.showPrices ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Visibility Status Explanations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    settings?.showPrices
                      ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1.5">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>When Show Prices is Enabled</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Individual test prices and total estimated fees are clearly visible to patients during direct online booking. Patients see live test fees before submitting their appointment requisition.
                  </p>
                </div>

                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    !settings?.showPrices
                      ? 'bg-amber-50/60 border-amber-300 text-amber-900 ring-2 ring-amber-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1.5">
                    <EyeOff className="w-4 h-4 text-amber-600" />
                    <span>When Hide Prices is Enabled</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Test prices are masked and replaced with "Price on Request" on the direct patient booking page. Patients can book tests without seeing prices upfront, and fee settlement occurs at the center.
                  </p>
                </div>
              </div>

              {/* Requirement 1 Guarantees Box */}
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200/80 text-xs space-y-1.5 text-purple-950">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span>Important Pricing Safeguards:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-purple-900/90 pl-1">
                  <li>
                    <strong>Prices Preserved in Database:</strong> Hiding prices does NOT remove, zero out, or modify actual test prices stored in the system.
                  </li>
                  <li>
                    <strong>Hospital Admin & Doctor Access:</strong> Hospital Admins and Doctors continue to see prices according to their permissions and existing clinical consultation workflows.
                  </li>
                  <li>
                    <strong>Individual Test Pricing:</strong> Lab Admin can configure and update prices for individual tests at any time in the <em>Lab Tests & Pricing</em> tab.
                  </li>
                </ul>
              </div>
            </Card>

            {/* Laboratory Profile Card */}
            <Card className="rounded-3xl border-slate-200 shadow-sm p-6 sm:p-8 bg-white space-y-4">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                Laboratory Facility Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Facility Name</span>
                  <strong className="text-slate-900 font-bold text-sm">{settings?.name || user?.name}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Facility Type</span>
                  <strong className="text-slate-900 font-bold text-sm">{settings?.type || 'INDEPENDENT'}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">License / Accreditation #</span>
                  <strong className="text-slate-900 font-bold text-sm font-mono">{settings?.licenseNumber || 'ACCREDITED'}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Official Contact</span>
                  <strong className="text-slate-900 font-bold text-sm">{settings?.email} • {settings?.phone}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 sm:col-span-2">
                  <span className="text-slate-500 block">Facility Address</span>
                  <strong className="text-slate-900 font-bold text-sm">{settings?.address || 'Not specified'}, {settings?.city || ''}</strong>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* SUBMIT REPORT MODAL (Requirement 19: PDF Document Upload) */}
      {isReportModalOpen && selectedRequest && (
        <Modal
          isOpen={isReportModalOpen}
          onClose={resetReportForm}
          title={`Upload & Publish Diagnostic Report - Requisition #${selectedRequest.requestNumber}`}
          maxWidth="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!reportFileUrl) {
                toast.error('Report Document Required', 'Please upload a PDF lab report before publishing.');
                return;
              }
              submitReportMutation.mutate({
                id: selectedRequest.id,
                data: {
                  results: `Official Diagnostic Laboratory Report: ${reportFileName || 'Attached PDF Document'}`,
                  fileUrl: reportFileUrl,
                  remarks: reportRemarks.trim() || undefined,
                },
              });
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="font-bold text-slate-900 block">{selectedRequest.patient?.fullName}</span>
                <span className="text-[10px] text-slate-500">MRN: {selectedRequest.patient?.patientIdNumber || 'OPD'}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-purple-900 block">Tests Ordered:</span>
                <span className="text-[11px] text-slate-600">
                  {(selectedRequest.testsList || []).map((t: any) => t.name).join(', ')}
                </span>
              </div>
            </div>

            {/* Local PDF File Upload (Drag & Drop + File Picker) - Requirement 19 */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Official Diagnostic Report Document (PDF) <span className="text-rose-500">*</span>
              </label>

              {!reportFileUrl ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handleFileSelect(files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all bg-slate-50/70 hover:bg-purple-50/30 ${
                    isUploadingPdf ? 'border-purple-400 pointer-events-none' : 'border-slate-300 hover:border-purple-400'
                  }`}
                >
                  <input
                    type="file"
                    id="lab-report-pdf-input"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleFileSelect(files[0]);
                      }
                    }}
                    disabled={isUploadingPdf}
                  />

                  {isUploadingPdf ? (
                    <div className="flex flex-col items-center justify-center py-2 space-y-2">
                      <InlineSpinner size="lg" className="text-purple-600" />
                      <p className="font-bold text-slate-700">{uploadProgressText || 'Uploading PDF report...'}</p>
                      <p className="text-[11px] text-slate-400">Please wait while your document is securely stored.</p>
                    </div>
                  ) : (
                    <label
                      htmlFor="lab-report-pdf-input"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                    >
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="font-bold text-purple-700 hover:underline">Click to browse</span> or drag and drop your PDF report here
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Supports signed diagnostic reports up to 10MB (.pdf)
                      </p>
                    </label>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-950 text-xs truncate max-w-xs">
                          {reportFileName || 'Diagnostic-Report.pdf'}
                        </span>
                        <Badge variant="success" className="text-[10px] shrink-0">Ready to Publish</Badge>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        {reportFileSize ? `${(reportFileSize / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                        Uploaded to secure medical storage
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={getMediaUrl(reportFileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center text-xs font-semibold"
                      title="Preview Document"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" /> Preview
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setReportPdfFile(null);
                        setReportFileUrl('');
                        setReportFileName('');
                        setReportFileSize(null);
                      }}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                      title="Remove and replace file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinical Remarks / Recommendation (Optional)</label>
              <input
                type="text"
                value={reportRemarks}
                onChange={(e) => setReportRemarks(e.target.value)}
                placeholder="e.g. Advised clinical correlation; repeat test in 4 weeks."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetReportForm}
                disabled={isUploadingPdf || submitReportMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                isLoading={isUploadingPdf || submitReportMutation.isPending}
                disabled={!reportFileUrl || isUploadingPdf}
              >
                Publish & Dispatch Official Report
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* VIEW REPORT FINDINGS MODAL */}
      {viewingReportRequest && (
        <Modal
          isOpen={!!viewingReportRequest}
          onClose={() => setViewingReportRequest(null)}
          title={`Official Report - Requisition #${viewingReportRequest.requestNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
              <span className="font-bold text-emerald-950 block text-sm">{viewingReportRequest.patient?.fullName}</span>
              <div className="text-[10px] text-emerald-700 flex items-center justify-between">
                <span>Completed on: {viewingReportRequest.report?.completedAt ? new Date(viewingReportRequest.report.completedAt).toLocaleString() : 'N/A'}</span>
                {viewingReportRequest.bookingSource === 'HOSPITAL' || viewingReportRequest.doctorId ? (
                  <span className="font-bold text-blue-700">Delivered to Requesting Hospital</span>
                ) : (
                  <span className="font-bold text-emerald-800">Published to Patient Portal</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-700 block">Report Findings:</span>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] whitespace-pre-wrap">
                {viewingReportRequest.report?.results}
              </div>
            </div>

            {viewingReportRequest.report?.remarks && (
              <div className="text-[11px] text-slate-600 italic">
                Remarks: "{viewingReportRequest.report.remarks}"
              </div>
            )}

            {viewingReportRequest.report?.fileUrl && (
              <a
                href={getMediaUrl(viewingReportRequest.report.fileUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-purple-600 font-bold underline block"
              >
                Open Official Report Document
              </a>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setViewingReportRequest(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ADD NEW TEST MODAL */}
      {isAddTestOpen && (
        <Modal
          isOpen={isAddTestOpen}
          onClose={() => setIsAddTestOpen(false)}
          title="Add Diagnostic Test to Laboratory Menu"
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTest.name.trim() || newTest.price === undefined) {
                toast.error('Validation Error', 'Test name and price are required.');
                return;
              }
              createTestMutation.mutate(newTest);
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Test Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTest.name}
                  onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                  placeholder="e.g. Lipid Profile"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Test Code (Optional)</label>
                <input
                  type="text"
                  value={newTest.code}
                  onChange={(e) => setNewTest({ ...newTest, code: e.target.value })}
                  placeholder="e.g. LIP02"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={newTest.category}
                  onChange={(e) => setNewTest({ ...newTest, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  {categories.filter((c) => c !== 'ALL').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Turnaround (Hours)</label>
                <input
                  type="number"
                  value={newTest.tatHours}
                  onChange={(e) => setNewTest({ ...newTest, tatHours: Number(e.target.value) || 24 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Price (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={newTest.price}
                  onChange={(e) => setNewTest({ ...newTest, price: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  placeholder="e.g. Pathology, Biochemistry, Radiology"
                  value={newTest.department}
                  onChange={(e) => setNewTest({ ...newTest, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Specimen</label>
                <input
                  type="text"
                  value={newTest.description}
                  onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                  placeholder="Sample requirements, fasting status..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddTestOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                isLoading={createTestMutation.isPending}
              >
                Create Test
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT TEST MODAL */}
      {editingTest && (
        <Modal
          isOpen={!!editingTest}
          onClose={() => setEditingTest(null)}
          title={`Edit Diagnostic Test - ${editingTest.name}`}
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateTestMutation.mutate({
                id: editingTest.id,
                data: {
                  name: editingTest.name.trim(),
                  code: editingTest.code?.trim(),
                  category: editingTest.category,
                  department: editingTest.department?.trim() || undefined,
                  description: editingTest.description,
                  tatHours: Number(editingTest.tatHours) || 24,
                  price: Number(editingTest.price) || 0,
                  status: editingTest.status,
                },
              });
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Test Name</label>
                <input
                  type="text"
                  value={editingTest.name}
                  onChange={(e) => setEditingTest({ ...editingTest, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Test Code</label>
                <input
                  type="text"
                  value={editingTest.code || ''}
                  onChange={(e) => setEditingTest({ ...editingTest, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={editingTest.category || 'Biochemistry'}
                  onChange={(e) => setEditingTest({ ...editingTest, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  {categories.filter((c) => c !== 'ALL').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Turnaround (Hours)</label>
                <input
                  type="number"
                  value={editingTest.tatHours || 24}
                  onChange={(e) => setEditingTest({ ...editingTest, tatHours: Number(e.target.value) || 24 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Price (₹)</label>
                <input
                  type="number"
                  value={editingTest.price}
                  onChange={(e) => setEditingTest({ ...editingTest, price: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  placeholder="e.g. Pathology, Biochemistry, Radiology"
                  value={editingTest.department || ''}
                  onChange={(e) => setEditingTest({ ...editingTest, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Specimen</label>
                <input
                  type="text"
                  value={editingTest.description || ''}
                  onChange={(e) => setEditingTest({ ...editingTest, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingTest(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                isLoading={updateTestMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* BULK IMPORT LAB TESTS MODAL */}
      {isImportModalOpen && (
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => {
            setIsImportModalOpen(false);
            setImportFile(null);
            setPreviewData(null);
            setImportSummary(null);
          }}
          title="Bulk Import Diagnostic Tests"
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Step 1: Download Sample Templates */}
            <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-purple-900 text-sm">Download Pre-Formatted Template</h4>
                  <p className="text-[11px] text-purple-700 mt-0.5">
                    Use our verified template with columns: <span className="font-mono font-bold">Test Name, Test Code, Category, Description, Price, Department</span>.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className="bg-white border-purple-300 text-purple-800 hover:bg-purple-100 text-xs font-bold"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Excel (.xlsx)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate('csv')}
                    className="bg-white border-purple-300 text-purple-800 hover:bg-purple-100 text-xs font-bold"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1 text-blue-600" /> CSV (.csv)
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 2: Upload File Dropzone */}
            {!importSummary && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Select Excel or CSV File to Upload
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handleSelectImportFile(files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all bg-slate-50/70 hover:bg-purple-50/30 ${
                    isPreviewLoading ? 'border-purple-400 pointer-events-none' : 'border-slate-300 hover:border-purple-400'
                  }`}
                >
                  <input
                    type="file"
                    id="lab-tests-import-file-input"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleSelectImportFile(files[0]);
                      }
                    }}
                    disabled={isPreviewLoading || isImporting}
                  />

                  {isPreviewLoading ? (
                    <div className="flex flex-col items-center justify-center py-2 space-y-2">
                      <InlineSpinner size="lg" className="text-purple-600" />
                      <p className="font-bold text-slate-700">Validating & parsing spreadsheet data...</p>
                      <p className="text-[11px] text-slate-400">Checking for duplicate test codes, missing columns, and pricing integrity.</p>
                    </div>
                  ) : importFile ? (
                    <div className="flex items-center justify-between p-2 bg-purple-50 rounded-xl border border-purple-200">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-6 h-6 text-purple-700" />
                        <div className="text-left">
                          <span className="font-bold text-slate-900 block">{importFile.name}</span>
                          <span className="text-[10px] text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                      <label
                        htmlFor="lab-tests-import-file-input"
                        className="cursor-pointer text-xs font-bold text-purple-700 hover:underline"
                      >
                        Change File
                      </label>
                    </div>
                  ) : (
                    <label
                      htmlFor="lab-tests-import-file-input"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-purple-700 hover:underline">Click to browse</span> or drag and drop your spreadsheet here
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Supports Excel (.xlsx, .xls) and CSV (.csv) files
                      </p>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Validation Preview Table */}
            {previewData && !importSummary && (
              <div className="space-y-3">
                {/* Metrics Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 block font-bold uppercase">Total Rows</span>
                    <span className="text-lg font-black text-slate-900">{previewData.totalRows}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                    <span className="text-[10px] text-emerald-700 block font-bold uppercase">Ready to Import</span>
                    <span className="text-lg font-black text-emerald-800">{previewData.validCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                    <span className="text-[10px] text-amber-700 block font-bold uppercase">Duplicates (Skipped)</span>
                    <span className="text-lg font-black text-amber-800">{previewData.duplicateCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                    <span className="text-[10px] text-rose-700 block font-bold uppercase">Errors</span>
                    <span className="text-lg font-black text-rose-800">{previewData.errorCount}</span>
                  </div>
                </div>

                {previewData.duplicateCount > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-800 text-[11px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      {previewData.duplicateCount} duplicate test records found in file or existing in catalog. To protect medical data integrity, duplicate tests will be skipped automatically.
                    </span>
                  </div>
                )}

                {/* Table Preview */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 font-bold">
                      <tr>
                        <th className="py-2 px-2.5">Row</th>
                        <th className="py-2 px-2.5">Code</th>
                        <th className="py-2 px-2.5">Test Name</th>
                        <th className="py-2 px-2.5">Category</th>
                        <th className="py-2 px-2.5">Department</th>
                        <th className="py-2 px-2.5">Price</th>
                        <th className="py-2 px-2.5">Status / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(previewData.rows || []).map((row: any) => {
                        const isImportable = row.isValid && !row.isDuplicate && !row.isExistingDuplicate;
                        return (
                          <tr
                            key={row.rowNumber}
                            className={
                              !row.isValid
                                ? 'bg-rose-50/50'
                                : row.isDuplicate || row.isExistingDuplicate
                                ? 'bg-amber-50/50'
                                : 'hover:bg-slate-50/50'
                            }
                          >
                            <td className="py-1.5 px-2.5 font-mono text-slate-400">#{row.rowNumber}</td>
                            <td className="py-1.5 px-2.5 font-mono font-bold text-purple-700">{row.code || '—'}</td>
                            <td className="py-1.5 px-2.5 font-bold text-slate-900">{row.name || '—'}</td>
                            <td className="py-1.5 px-2.5 text-slate-600">{row.category}</td>
                            <td className="py-1.5 px-2.5 text-slate-600">{row.department || '—'}</td>
                            <td className="py-1.5 px-2.5 font-semibold text-slate-900">₹{row.price}</td>
                            <td className="py-1.5 px-2.5">
                              {isImportable ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Valid
                                </span>
                              ) : row.isExistingDuplicate ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800" title="Already exists in lab catalog">
                                  Catalog Duplicate
                                </span>
                              ) : row.isDuplicate ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800" title="Duplicate code inside file">
                                  File Duplicate
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800" title={row.errors?.join(', ')}>
                                  {row.errors?.[0] || 'Invalid'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 4: Import Complete Summary */}
            {importSummary && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Bulk Import Completed Successfully</h4>
                <div className="grid grid-cols-3 gap-2 pt-2 max-w-sm mx-auto text-center">
                  <div className="p-2 bg-white rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Imported</span>
                    <span className="text-base font-black text-emerald-700">{importSummary.imported}</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Skipped</span>
                    <span className="text-base font-black text-amber-700">{importSummary.duplicatesSkipped}</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Errors</span>
                    <span className="text-base font-black text-rose-700">{importSummary.errorsCount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setPreviewData(null);
                  setImportSummary(null);
                }}
              >
                {importSummary ? 'Close' : 'Cancel'}
              </Button>

              {previewData && !importSummary && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmImport}
                  isLoading={isImporting}
                  disabled={previewData.validCount === 0 || isImporting}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" /> Import {previewData.validCount} Tests
                </Button>
              )}

              {importSummary && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setPreviewData(null);
                    setImportSummary(null);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* EXPORT LAB TESTS MODAL */}
      {isExportModalOpen && (
        <Modal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title="Export Laboratory Test Master Catalog"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Export your diagnostic tests into Excel (.xlsx) or CSV (.csv) format. Filter by category, department, or status before exporting.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Export Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportFormat('xlsx')}
                  className={`p-3 rounded-xl border text-center font-bold flex items-center justify-center gap-2 transition-all ${
                    exportFormat === 'xlsx'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('csv')}
                  className={`p-3 rounded-xl border text-center font-bold flex items-center justify-center gap-2 transition-all ${
                    exportFormat === 'csv'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  CSV (.csv)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Filter by Category</label>
              <select
                value={exportCategory}
                onChange={(e) => setExportCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Filter by Department</label>
              <input
                type="text"
                placeholder="All departments or type department name (e.g., Pathology)"
                value={exportDepartment === 'ALL' ? '' : exportDepartment}
                onChange={(e) => setExportDepartment(e.target.value || 'ALL')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Filter by Status</label>
              <select
                value={exportStatus}
                onChange={(e) => setExportStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium"
              >
                <option value="ALL">All Statuses (Active & Disabled)</option>
                <option value="ACTIVE">Active Tests Only</option>
                <option value="INACTIVE">Disabled / Inactive Tests Only</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                isLoading={isExporting}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Download Export File
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
