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
  ExternalLink,
  Plus,
  Trash2,
  Edit,
  DollarSign,
  X,
  Tag,
  ToggleLeft,
  ToggleRight,
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

  // Primary Tab: 'requests' | 'tests'
  const [activeMainTab, setActiveMainTab] = useState<'requests' | 'tests'>('requests');

  // Requisitions States
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
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
    tatHours: 24,
    price: 500,
  });

  // Fetch lab requests
  const { data: requests, isLoading: isRequestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['lab-requests', statusFilter],
    queryFn: () => labApi.getRequests(statusFilter === 'ALL' ? undefined : statusFilter),
    refetchInterval: 10000,
    enabled: activeMainTab === 'requests',
  });

  // Immediate popup/toast notifications when new lab requests arrive (Requirement 13)
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
  const { data: labTests, isLoading: isTestsLoading, refetch: refetchLabTests } = useQuery({
    queryKey: ['technician-lab-tests', testCategoryFilter, testSearch],
    queryFn: () => labApi.getTests(testCategoryFilter === 'ALL' ? undefined : testCategoryFilter, testSearch || undefined),
    enabled: activeMainTab === 'tests',
  });

  // Status update mutation (handles ACCEPTED, RECEIVED, PROCESSING, COMPLETED, CANCELLED)
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      labApi.updateStatus(id, status),
    onSuccess: (_, vars) => {
      toast.success('Status Updated', `Test requisition status set to ${vars.status}`);
      queryClient.invalidateQueries({ queryKey: ['lab-requests'] });
    },
    onError: (err: any) => {
      toast.error('Status Update Failed', err.message);
    },
  });

  // Submit report mutation
  const submitReportMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => labApi.submitReport(id, data),
    onSuccess: () => {
      toast.success('Lab Report Published', 'Diagnostic report saved and dispatched to patient and doctor');
      resetReportForm();
      queryClient.invalidateQueries({ queryKey: ['lab-requests'] });
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
      setNewTest({ name: '', code: '', category: 'Biochemistry', description: '', tatHours: 24, price: 500 });
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

  const filteredRequests = (requests || []).filter((req) => {
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
              Diagnostic Laboratory Portal
            </span>
            <span className="text-sm font-extrabold text-white">
              {user?.lab?.name || user?.hospital?.name || 'Accredited Pathology & Diagnostic Lab'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:block text-right">
            <div className="font-bold text-slate-200">{user?.name}</div>
            <div className="text-[11px] text-purple-400 font-mono">
              License: {user?.lab?.licenseNumber || 'ACCREDITED'}
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
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveMainTab('requests')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeMainTab === 'requests'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              Requisitions Queue
              {(requests || []).filter((r: any) => r.status === 'REQUESTED').length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {(requests || []).filter((r: any) => r.status === 'REQUESTED').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveMainTab('tests')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeMainTab === 'tests'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Tag className="w-4 h-4" />
              Lab Tests & Pricing ({(labTests || []).length})
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: REQUISITIONS QUEUE */}
        {/* ======================================================== */}
        {activeMainTab === 'requests' && (
          <div className="space-y-6">
            {/* Title & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <FlaskConical className="w-6 h-6 text-purple-600" />
                  Diagnostic Test Requests & Processing Queue
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Receive patient test orders from OPD doctors and direct bookings, process specimens, and publish diagnostic findings
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search requisition #, MRN, patient..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchRequests()} className="text-xs shrink-0">
                  Refresh
                </Button>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar whitespace-nowrap max-w-fit">
              {['ALL', 'REQUESTED', 'ACCEPTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === status
                      ? 'bg-white text-purple-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status === 'ALL' ? 'All Orders' : status}
                </button>
              ))}
            </div>

            {/* Requisitions Table */}
            <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Requisition #</th>
                      <th className="px-5 py-3.5">Patient Details</th>
                      <th className="px-5 py-3.5">Ordered Tests</th>
                      <th className="px-5 py-3.5">Ordering Doctor / Hospital</th>
                      <th className="px-5 py-3.5">Priority</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {isRequestsLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          Loading diagnostic requisitions...
                        </td>
                      </tr>
                    ) : filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          No diagnostic requests found in this view.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((req) => {
                        const parsedTests = req.testsList || [];
                        return (
                          <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="font-mono font-bold text-purple-700 block">
                                {req.requestNumber}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {req.totalAmount ? (
                                <span className="text-[10px] font-bold text-emerald-700 block">
                                  ₹{req.totalAmount}
                                </span>
                              ) : null}
                            </td>

                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900">{req.patient?.fullName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                MRN: {req.patient?.patientIdNumber || 'OPD'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                +91 {req.patient?.mobileNumber} • {req.patient?.gender}
                              </div>
                            </td>

                            <td className="px-5 py-3.5">
                              <div className="space-y-1 max-w-xs">
                                {parsedTests.map((t: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="p-1.5 bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-800 flex items-center justify-between"
                                  >
                                    <span>• {t.name}</span>
                                    {t.price && <span className="text-purple-600 font-mono text-[10px]">₹{t.price}</span>}
                                  </div>
                                ))}
                                {req.clinicalNotes && (
                                  <div className="text-[10px] text-slate-500 italic pt-0.5">
                                    Notes: "{req.clinicalNotes}"
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-3.5">
                              {req.doctor ? (
                                <>
                                  <div className="font-semibold text-slate-800">{req.doctor.name}</div>
                                  <div className="text-[10px] text-slate-500">{req.hospital?.name}</div>
                                </>
                              ) : (
                                <span className="text-slate-500 italic">Direct Online Booking</span>
                              )}
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
                                    : req.status === 'ACCEPTED' || req.status === 'RECEIVED'
                                    ? 'info'
                                    : req.status === 'CANCELLED' || req.status === 'REJECTED'
                                    ? 'danger'
                                    : 'warning'
                                }
                                className="text-[10px]"
                              >
                                {req.status}
                              </Badge>
                            </td>

                            <td className="px-5 py-3.5 text-right space-x-2">
                              {/* APPROVE / REJECT ACTIONS for REQUESTED status */}
                              {req.status === 'REQUESTED' && (
                                <div className="inline-flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                    onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'ACCEPTED' })}
                                    isLoading={updateStatusMutation.isPending}
                                  >
                                    <Check className="w-3.5 h-3.5 mr-1" /> Approve & Receive
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-rose-600 border-rose-300 hover:bg-rose-50 font-bold text-xs"
                                    onClick={() => {
                                      if (window.confirm('Reject this test requisition?')) {
                                        updateStatusMutation.mutate({ id: req.id, status: 'CANCELLED' });
                                      }
                                    }}
                                    isLoading={updateStatusMutation.isPending}
                                  >
                                    <X className="w-3.5 h-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              )}

                              {/* START TESTING action for ACCEPTED / RECEIVED */}
                              {(req.status === 'ACCEPTED' || req.status === 'RECEIVED') && (
                                <Button
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                                  onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'PROCESSING' })}
                                  isLoading={updateStatusMutation.isPending}
                                >
                                  Start Testing
                                </Button>
                              )}

                              {/* SUBMIT REPORT action for PROCESSING */}
                              {req.status === 'PROCESSING' && (
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setIsReportModalOpen(true);
                                  }}
                                >
                                  <FileText className="w-3.5 h-3.5 mr-1" /> Submit Report
                                </Button>
                              )}

                              {/* VIEW FINDINGS for COMPLETED */}
                              {req.status === 'COMPLETED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs font-semibold"
                                  onClick={() => setViewingReportRequest(req)}
                                >
                                  View Findings
                                </Button>
                              )}

                              {/* CANCELLED or REJECTED */}
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

              <div className="flex items-center gap-3">
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
                          className="text-rose-600 hover:bg-rose-50 text-xs"
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
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="font-bold text-emerald-950 block">{viewingReportRequest.patient?.fullName}</span>
              <span className="text-[10px] text-emerald-700">
                Completed on: {viewingReportRequest.report?.completedAt ? new Date(viewingReportRequest.report.completedAt).toLocaleString() : 'N/A'}
              </span>
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

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description / Specimen</label>
              <textarea
                rows={2}
                value={newTest.description}
                onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                placeholder="Sample requirements, fasting status, or test details..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
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

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description / Specimen</label>
              <textarea
                rows={2}
                value={editingTest.description || ''}
                onChange={(e) => setEditingTest({ ...editingTest, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
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
    </div>
  );
};
