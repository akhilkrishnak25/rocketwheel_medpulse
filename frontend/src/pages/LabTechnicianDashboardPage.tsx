import React, { useState } from 'react';
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
} from 'lucide-react';
import { labApi } from '../api/lab.api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { LabTestRequest } from '../types';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const LabTechnicianDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, logout } = useAuth();

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<LabTestRequest | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [viewingReportRequest, setViewingReportRequest] = useState<LabTestRequest | null>(null);

  // Submit Report Form State
  const [reportResults, setReportResults] = useState('');
  const [reportFileUrl, setReportFileUrl] = useState('');
  const [reportRemarks, setReportRemarks] = useState('');

  // Fetch lab requests
  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['lab-requests', statusFilter],
    queryFn: () => labApi.getRequests(statusFilter === 'ALL' ? undefined : statusFilter),
    refetchInterval: 10000,
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' }) =>
      labApi.updateStatus(id, status),
    onSuccess: (_, vars) => {
      toast.success('Status Updated', `Test requisition set to ${vars.status}`);
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
      toast.success('Lab Report Published', 'Diagnostic results saved and dispatched to patient and doctor');
      setIsReportModalOpen(false);
      setSelectedRequest(null);
      setReportResults('');
      setReportFileUrl('');
      setReportRemarks('');
      queryClient.invalidateQueries({ queryKey: ['lab-requests'] });
    },
    onError: (err: any) => {
      toast.error('Submission Failed', err.message);
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
        {/* Title & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-purple-600" />
              Diagnostic Test Requests & Processing Queue
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Receive patient test orders from OPD doctors, process specimens, and publish diagnostic findings
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
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs shrink-0">
              Refresh
            </Button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar whitespace-nowrap max-w-fit">
          {['ALL', 'REQUESTED', 'RECEIVED', 'PROCESSING', 'COMPLETED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                statusFilter === status ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Requisitions Table */}
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              Laboratory Test Orders ({filteredRequests.length})
            </CardTitle>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Requisition #</th>
                  <th className="px-5 py-3">Patient Details</th>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Tests Ordered</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      Loading laboratory orders...
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No diagnostic requisitions found under this status filter.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req: any) => {
                    const parsedTests = typeof req.tests === 'string' ? JSON.parse(req.tests) : req.tests;
                    return (
                      <tr key={req.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-mono font-bold text-purple-700">
                          {req.requestNumber}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{req.patient?.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            MRN: {req.patient?.patientIdNumber || 'PENDING'} • {req.patient?.mobileNumber}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-800">
                          Dr. {req.doctor?.name || 'Consultant'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="space-y-0.5">
                            {(parsedTests || []).map((t: any, i: number) => (
                              <div key={i} className="font-semibold text-slate-900">
                                • {t.name}
                              </div>
                            ))}
                          </div>
                          {req.clinicalNotes && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5">
                              Indications: {req.clinicalNotes}
                            </div>
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
                                : req.status === 'RECEIVED'
                                ? 'info'
                                : 'warning'
                            }
                            className="text-[10px]"
                          >
                            {req.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          {req.status === 'REQUESTED' && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                              onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'RECEIVED' })}
                              isLoading={updateStatusMutation.isPending}
                            >
                              Receive Specimen
                            </Button>
                          )}

                          {req.status === 'RECEIVED' && (
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                              onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'PROCESSING' })}
                              isLoading={updateStatusMutation.isPending}
                            >
                              Start Testing
                            </Button>
                          )}

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

      {/* SUBMIT REPORT MODAL */}
      {isReportModalOpen && selectedRequest && (
        <Modal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          title={`Publish Diagnostic Report - Requisition #${selectedRequest.requestNumber}`}
          maxWidth="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!reportResults.trim()) {
                toast.error('Results Required', 'Please enter the diagnostic findings or test summary.');
                return;
              }
              submitReportMutation.mutate({
                id: selectedRequest.id,
                data: {
                  results: reportResults.trim(),
                  fileUrl: reportFileUrl.trim() || undefined,
                  remarks: reportRemarks.trim() || undefined,
                },
              });
            }}
            className="space-y-4 text-xs"
          >
            {/* Header info */}
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="font-bold text-slate-900 block">{selectedRequest.patient?.fullName}</span>
                <span className="font-mono text-[11px]">MRN: {selectedRequest.patient?.patientIdNumber || 'PENDING'}</span>
              </div>
              <div className="text-right">
                <span className="font-semibold block">Doctor: Dr. {selectedRequest.doctor?.name}</span>
                <span className="text-[11px] text-purple-700 font-bold">{selectedRequest.priority} Priority</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Diagnostic Findings & Parameter Values <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={5}
                value={reportResults}
                onChange={(e) => setReportResults(e.target.value)}
                placeholder="e.g. Hemoglobin: 13.8 g/dL (Normal: 13.0-17.0)&#10;Total Leucocyte Count (TLC): 7,200 /cu.mm&#10;Platelet Count: 2.4 Lakhs /cu.mm&#10;Impression: Normal blood counts."
                className="w-full font-mono text-xs p-3 rounded-xl border border-slate-200 focus:ring-purple-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Report PDF / File Download URL (Optional)
              </label>
              <input
                type="url"
                value={reportFileUrl}
                onChange={(e) => setReportFileUrl(e.target.value)}
                placeholder="https://storage.medpulse.health/reports/LAB-REQ-0001.pdf"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Technician Remarks & Sign-off Notes
              </label>
              <input
                type="text"
                value={reportRemarks}
                onChange={(e) => setReportRemarks(e.target.value)}
                placeholder="Verified by Senior Pathologist on duty."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsReportModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                isLoading={submitReportMutation.isPending}
              >
                Publish & Complete Order
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* VIEW REPORT MODAL */}
      {viewingReportRequest && viewingReportRequest.report && (
        <Modal
          isOpen={!!viewingReportRequest}
          onClose={() => setViewingReportRequest(null)}
          title={`Diagnostic Findings - ${viewingReportRequest.requestNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-900">{viewingReportRequest.patient?.fullName}</div>
              <div className="text-[11px] text-slate-500 font-mono">
                MRN: {viewingReportRequest.patient?.patientIdNumber || 'PENDING'}
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 block mb-1">Report Results:</span>
              <pre className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono whitespace-pre-wrap text-slate-800 leading-relaxed text-xs">
                {viewingReportRequest.report.results}
              </pre>
            </div>

            {viewingReportRequest.report.remarks && (
              <div className="text-slate-600 italic">
                Remarks: {viewingReportRequest.report.remarks}
              </div>
            )}

            {viewingReportRequest.report.fileUrl && (
              <div>
                <a
                  href={viewingReportRequest.report.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-royal-600 font-bold underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Official Report PDF
                </a>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button size="sm" variant="outline" onClick={() => setViewingReportRequest(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
