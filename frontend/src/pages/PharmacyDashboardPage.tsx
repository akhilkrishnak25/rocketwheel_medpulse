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
  LogOut,
  FileText,
  PackageCheck,
} from 'lucide-react';
import { pharmacyApi } from '../api/pharmacy.api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { Prescription } from '../types';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const PharmacyDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, logout } = useAuth();

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
              <ShoppingBag className="w-6 h-6 text-emerald-600" />
              Prescription Dispensing Queue
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live orders routed directly from doctor OPD consultations for medication dispensing
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
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs shrink-0">
              Refresh
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
              const meds = typeof rx.medicines === 'string' ? JSON.parse(rx.medicines) : rx.medicines;
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

                    {/* Medicines List */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-600 block uppercase tracking-wide">
                        Medications to Dispense:
                      </span>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {(meds || []).map((m: any, i: number) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-200/60 flex items-start justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900">{m.name}</div>
                              <div className="text-[11px] text-slate-600">
                                {m.dosage} • {m.frequency} • {m.duration}
                              </div>
                            </div>
                            {m.instructions && (
                              <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded">
                                {m.instructions}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {rx.instructions && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                        Doctor Advice: "{rx.instructions}"
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">
                      Prescribed: {new Date(rx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div className="flex items-center gap-2">
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
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Dispensed
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
    </div>
  );
};
