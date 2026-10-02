import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FlaskConical,
  Search,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Trash2,
  Plus,
  ShieldCheck,
  ArrowRight,
  Filter,
  FileText,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { labApi } from '../api/lab.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';

export const LabTestsPage: React.FC = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLabId = searchParams.get('labId') || '';

  const [selectedLabId, setSelectedLabId] = useState<string>(initialLabId);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Cart / Selected Tests
  const [cartTests, setCartTests] = useState<any[]>([]);

  // Customer Booking Form State
  const [patientName, setPatientName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('MALE');
  const [age, setAge] = useState<number | ''>('');
  const [address, setAddress] = useState('');
  const [preferredDate, setPreferredDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');

  // Completed Booking Confirmation State
  const [bookingConfirmation, setBookingConfirmation] = useState<any | null>(null);

  // Requisition Status Lookup State
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Fetch Accredited Laboratories
  const { data: labs } = useQuery({
    queryKey: ['public-active-labs'],
    queryFn: () => labApi.getActiveLabs(),
  });

  // Fetch Public Available Tests Catalog
  const { data: tests, isLoading: testsLoading } = useQuery({
    queryKey: ['public-lab-tests', selectedLabId, selectedCategory, searchTerm],
    queryFn: () =>
      labApi.getPublicTests({
        labId: selectedLabId || undefined,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        search: searchTerm || undefined,
      }),
  });

  // Booking Mutation
  const bookMutation = useMutation({
    mutationFn: (payload: any) => labApi.bookTest(payload),
    onSuccess: (data: any) => {
      toast.success('Test Booked Successfully!', `Requisition #${data.data?.requestNumber || ''}`);
      setBookingConfirmation(data.data);
      setCartTests([]);
      setPatientName('');
      setMobileNumber('');
      setEmail('');
      setAddress('');
      setNotes('');
    },
    onError: (err: any) => {
      toast.error('Booking Failed', err.message);
    },
  });

  const categories = [
    'ALL',
    'Hematology',
    'Biochemistry',
    'Clinical Pathology',
    'Diabetes Care',
    'Endocrinology',
    'Radiology',
    'Specialized Immunology',
  ];

  const handleAddToCart = (test: any) => {
    // If cart has tests from another lab, alert user
    if (cartTests.length > 0 && cartTests[0].labId !== test.labId) {
      if (
        !window.confirm(
          'Your selection contains tests from a different lab. Switching labs will reset your selected tests. Continue?'
        )
      ) {
        return;
      }
      setCartTests([test]);
      setSelectedLabId(test.labId);
      return;
    }

    if (!cartTests.some((t) => t.id === test.id)) {
      setCartTests([...cartTests, test]);
      setSelectedLabId(test.labId);
      toast.success('Test Added', `${test.name} added to your booking.`);
    }
  };

  const handleRemoveFromCart = (testId: string) => {
    setCartTests(cartTests.filter((t) => t.id !== testId));
  };

  const totalCartAmount = cartTests.reduce((sum, t) => sum + (t.price || 0), 0);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await labApi.getBookingStatus(lookupQuery.trim());
      setLookupResult(res.data);
    } catch (err: any) {
      toast.error('Search Failed', err.message || 'Requisition not found.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (cartTests.length === 0) {
      toast.error('No Tests Selected', 'Please select at least one lab test to proceed.');
      return;
    }
    if (!patientName.trim() || !mobileNumber.trim()) {
      toast.error('Missing Details', 'Patient name and mobile number are required.');
      return;
    }

    const targetLabId = cartTests[0].labId || selectedLabId;

    bookMutation.mutate({
      labId: targetLabId,
      patientName: patientName.trim(),
      mobileNumber: mobileNumber.trim(),
      email: email.trim() || undefined,
      gender,
      age: age ? Number(age) : undefined,
      address: address.trim() || undefined,
      preferredDate,
      testIds: cartTests.map((t) => t.id),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* HERO BANNER */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-royal-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
          <div className="max-w-3xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-bold border border-white/10">
              <FlaskConical className="w-4 h-4 text-purple-400" />
              <span>Certified Diagnostic Laboratories & Pathology Centers</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Book Diagnostic Tests & Health Checks Online
            </h1>
            <p className="text-purple-100 text-sm sm:text-base leading-relaxed">
              Transparent live laboratory prices from accredited hospital laboratories and standalone diagnostic centers.
              Receive rapid specimen collection and secure online report access.
            </p>
          </div>
        </div>

        {/* BOOKING CONFIRMATION MODAL / OVERLAY */}
        {bookingConfirmation && (
          <Card className="rounded-3xl border-2 border-emerald-500 bg-emerald-50/50 p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-600 text-white rounded-2xl shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Booking Confirmed
                  </span>
                  <Badge variant="success">Status: {bookingConfirmation.status}</Badge>
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  Requisition Reference #{bookingConfirmation.requestNumber}
                </h2>
                <p className="text-xs text-slate-600">
                  Your diagnostic test booking has been dispatched to{' '}
                  <strong className="text-slate-900">{bookingConfirmation.labName}</strong>.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-emerald-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Patient Name</span>
                <strong className="text-slate-900 font-bold text-sm">{bookingConfirmation.patientName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Scheduled Date</span>
                <strong className="text-slate-900 font-bold text-sm">
                  {bookingConfirmation.preferredDate ? new Date(bookingConfirmation.preferredDate).toLocaleDateString() : 'Next Available'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Total Amount Payable at Center</span>
                <strong className="text-emerald-700 font-black text-base">₹{bookingConfirmation.totalAmount}</strong>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-xs block">Tests Scheduled:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(bookingConfirmation.tests || []).map((t: any, i: number) => (
                  <div key={i} className="p-2.5 bg-white rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800">• {t.name}</span>
                    <span className="font-bold text-purple-700">₹{t.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setBookingConfirmation(null)}
                className="bg-emerald-600 hover:bg-emerald-700 font-bold"
              >
                Book Another Test
              </Button>
              <Link to="/">
                <Button variant="outline" size="sm" className="font-bold">
                  Return to Home
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* STATUS LOOKUP BAR */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-purple-600" />
                Track Diagnostic Requisition Status
              </h3>
              <p className="text-xs text-slate-500">
                Already booked? Enter your Requisition # (e.g. LAB-20261002-XXXX) to check testing status and results
              </p>
            </div>

            <form onSubmit={handleLookup} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="Enter LAB-XXXX requisition #"
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 w-full sm:w-64 font-mono"
              />
              <Button type="submit" size="sm" isLoading={lookupLoading} className="bg-purple-600 hover:bg-purple-700 text-white font-bold shrink-0 text-xs">
                Check Status
              </Button>
            </form>
          </div>

          {lookupResult && (
            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3 text-xs mt-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-purple-950 block text-sm">
                    Requisition #{lookupResult.requestNumber}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Patient: {lookupResult.patient?.fullName} • Lab: {lookupResult.lab?.name}
                  </span>
                </div>
                <Badge
                  variant={
                    lookupResult.status === 'COMPLETED'
                      ? 'success'
                      : lookupResult.status === 'PROCESSING'
                      ? 'purple'
                      : lookupResult.status === 'ACCEPTED'
                      ? 'info'
                      : 'warning'
                  }
                >
                  {lookupResult.status}
                </Badge>
              </div>

              {lookupResult.report && (
                <div className="p-3 bg-white rounded-lg border border-purple-200 space-y-1.5 font-mono text-[11px]">
                  <span className="font-bold text-emerald-800 block">Official Results:</span>
                  <div className="whitespace-pre-wrap text-slate-800">{lookupResult.report.results}</div>
                  {lookupResult.report.fileUrl && (
                    <a
                      href={lookupResult.report.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-600 font-bold underline block pt-1"
                    >
                      Download Official Diagnostic PDF
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MAIN TWO-COLUMN CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* LEFT 2 COLS: SEARCH, FILTERS & TESTS CATALOG */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search and Filter Controls */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search test name (CBC, Lipid, LFT...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                </div>

                {/* Laboratory Filter */}
                <select
                  value={selectedLabId}
                  onChange={(e) => setSelectedLabId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 font-medium text-slate-700"
                >
                  <option value="">All Accredited Diagnostic Labs</option>
                  {(labs || []).map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.hospital ? `(${l.hospital.city})` : ''} - {l.testsCount || 0} tests
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Specialities' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Cards List */}
            <div className="space-y-3">
              {testsLoading ? (
                <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                  Loading laboratory test catalog...
                </div>
              ) : (tests || []).length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  No tests found matching your criteria. Try adjusting your search or category filter.
                </div>
              ) : (
                (tests || []).map((test: any) => {
                  const isInCart = cartTests.some((t) => t.id === test.id);
                  return (
                    <Card
                      key={test.id}
                      className="rounded-2xl border-slate-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                              {test.code || 'TEST'}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {test.category || 'General Pathology'}
                            </Badge>
                            {test.lab && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                Provided by: <strong className="text-slate-800">{test.lab.name}</strong>
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                            {test.name}
                          </h3>

                          {test.description && (
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {test.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              Report Turnaround: <strong>{test.tatHours ? `${test.tatHours} hours` : 'Same Day'}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-slate-400 block font-medium">Fixed Lab Fee</span>
                            <span className="text-xl font-black text-slate-900">
                              ₹{test.price}
                            </span>
                          </div>

                          {isInCart ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveFromCart(test.id)}
                              className="text-rose-600 border-rose-300 hover:bg-rose-50 font-bold text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleAddToCart(test)}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" /> Add Test
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COL: BOOKING CART & PATIENT FORM (STICKY) */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <Card className="rounded-3xl border-slate-200 shadow-md p-6 space-y-6 bg-white">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-purple-600" />
                    Diagnostic Booking Summary
                  </h2>
                  <p className="text-[11px] text-slate-500">Zero login or account needed</p>
                </div>
                <Badge variant="purple" className="text-xs font-bold">
                  {cartTests.length} Selected
                </Badge>
              </div>

              {/* Selected Tests List */}
              {cartTests.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No tests added yet. Click '+ Add Test' on any test card on the left.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {cartTests.map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-slate-900 block truncate">{t.name}</span>
                          <span className="text-[10px] text-slate-400">{t.category}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-purple-700">₹{t.price}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(t.id)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between font-bold">
                    <span className="text-slate-700 text-xs">Total Estimated Fee:</span>
                    <span className="text-xl font-black text-purple-900">₹{totalCartAmount}</span>
                  </div>
                </div>
              )}

              {/* Patient Direct Booking Form */}
              <form onSubmit={handleSubmitBooking} className="space-y-3.5 pt-2 border-t border-slate-100 text-xs">
                <span className="font-bold text-slate-900 block text-xs">Patient & Contact Details:</span>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Patient Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 35"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Preferred Date</label>
                    <input
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="patient@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Address / Center Preference</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Home address or nearest center"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Special Instructions (Optional)</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Fasting status, doctor referral note..."
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={cartTests.length === 0}
                  isLoading={bookMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-3 rounded-xl shadow-md text-sm"
                >
                  Confirm Diagnostic Booking (₹{totalCartAmount})
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
