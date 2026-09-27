import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  FileText,
  User,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';
import { authApi } from '../api/auth.api';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';

const AVAILABLE_FACILITIES = [
  '24/7 Emergency & Trauma Care',
  'Intensive Care Unit (ICU / CCU)',
  'In-house 24/7 Pharmacy',
  'Advanced Pathology Laboratory',
  'Radiology, CT & 3T MRI',
  'Cardiac Catheterization Lab',
  'Dedicated Blood Bank',
  'NICU / PICU Units',
  'Ambulance & Life Support Fleet',
  'Valet Parking & Patient Lounges',
];

export const HospitalRegistrationPage: React.FC = () => {
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    licenseNumber: '',
    email: '',
    phone: '',
    emergencyContact: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    website: '',
    openingHours: '24/7 (Emergency), OPD: 08:30 AM - 08:00 PM',
    about: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
  });

  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([
    '24/7 Emergency & Trauma Care',
    'In-house 24/7 Pharmacy',
    'Advanced Pathology Laboratory',
  ]);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    hospitalName: string;
    hospitalId?: string;
    status: string;
    activationLink?: string;
  } | null>(null);

  const toggleFacility = (facility: string) => {
    setSelectedFacilities((prev) =>
      prev.includes(facility) ? prev.filter((f) => f !== facility) : [...prev, facility]
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = {
        ...formData,
        facilities: selectedFacilities,
      };

      const res = await authApi.registerHospital(payload);
      setSubmissionResult({
        hospitalName: formData.name,
        hospitalId: res?.hospitalId,
        status: 'PENDING',
        activationLink: (res as any)?.activationLink,
      });

      toast.success(
        'Application Submitted',
        'Hospital registration submitted successfully! Our medical board will review your accreditation details.'
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check the provided information.');
      toast.error('Registration Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (submissionResult) {
    return (
      <div className="min-h-[85vh] py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <Card className="rounded-3xl p-8 sm:p-12 shadow-2xl border-slate-200 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
              Status: Awaiting Super Admin Review
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Registration Application Received!
            </h1>
            <p className="text-sm text-slate-600 max-w-lg mx-auto">
              Thank you for applying to onboard <strong>{submissionResult.hospitalName}</strong> to the MediPulse Multi-Hospital Platform.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3 max-w-xl mx-auto text-xs text-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
              <span className="font-semibold text-slate-500">Institution:</span>
              <span className="font-bold text-slate-900">{submissionResult.hospitalName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
              <span className="font-semibold text-slate-500">Administrator Contact:</span>
              <span className="font-medium text-slate-900">{formData.adminEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Review Window:</span>
              <span className="font-medium text-slate-900">24 to 48 business hours</span>
            </div>
          </div>

          {submissionResult.activationLink && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2 max-w-xl mx-auto">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Evaluation / Development Shortcut:</span>
              </div>
              <p className="text-xs text-amber-700">
                You can approve this hospital immediately via the <strong>Super Admin Dashboard</strong> (Pending Approvals tab) or test direct invitation activation:
              </p>
              <Link
                to={submissionResult.activationLink}
                className="inline-flex items-center justify-center w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
              >
                Open Hospital Administrator Activation Link →
              </Link>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link to="/" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">
                Return to Homepage
              </Button>
            </Link>
            <Link to="/staff/login" className="w-full sm:w-auto">
              <Button className="w-full bg-royal-600 hover:bg-royal-700 text-white font-bold">
                Staff Portal Sign In <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3 mb-8">
        <Link to="/" className="inline-flex items-center justify-center group mb-1">
          <RocketWheelLogo size="lg" />
        </Link>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Partner Hospital Registration
        </h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Join India's premier multi-hospital appointment network. Streamline your OPD slots, patient queues, and digital OP consultation cards.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Hospital Profile */}
        <Card className="rounded-2xl p-6 sm:p-8 shadow-sm border-slate-200 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="w-9 h-9 rounded-xl bg-royal-50 border border-royal-200 flex items-center justify-center text-royal-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Hospital Institutional Details</h2>
              <p className="text-xs text-slate-500">Official identification and contact information</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Hospital / Medical Center Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Continental Hospitals Gachibowli"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Registration / Accreditation License Number</label>
              <input
                type="text"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleChange}
                placeholder="e.g. NABH-2026-HC-0419"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hospital Network Code (Optional Prefix)</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="e.g. CONT-HYD"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Hospital Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="info@hospital.org"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hospital General Contact Phone *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 40 1234 5678"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Emergency Hotline (24/7)</label>
              <input
                type="text"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleChange}
                placeholder="e.g. +91 40 1066"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hospital Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://www.hospital.org"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Full Physical Street Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Plot No. 3, Financial District, Nanakramguda"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">City *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g. Hyderabad"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">State *</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="e.g. Telangana"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">PIN Code (6 digits) *</label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder="500032"
                maxLength={6}
                pattern="\d{6}"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">OPD Hours & Timings</label>
              <input
                type="text"
                name="openingHours"
                value={formData.openingHours}
                onChange={handleChange}
                placeholder="24/7 (Emergency), OPD: 08:30 AM - 08:00 PM"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">About Hospital & Clinical Focus *</label>
              <textarea
                name="about"
                value={formData.about}
                onChange={handleChange}
                rows={3}
                placeholder="Briefly describe your healthcare facility, clinical specializations, and patient care standards..."
                className="w-full text-sm p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
                minLength={10}
              />
            </div>
          </div>

          {/* Facilities Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">
              Select Available Facilities & Services
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {AVAILABLE_FACILITIES.map((facility) => {
                const isSelected = selectedFacilities.includes(facility);
                return (
                  <button
                    key={facility}
                    type="button"
                    onClick={() => toggleFacility(facility)}
                    className={`p-2.5 rounded-xl text-left border flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-royal-50 border-royal-300 text-royal-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{facility}</span>
                    <span
                      className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                        isSelected
                          ? 'bg-royal-600 border-royal-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Section 2: Designated Hospital Administrator Account */}
        <Card className="rounded-2xl p-6 sm:p-8 shadow-sm border-slate-200 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="w-9 h-9 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Hospital Administrator Account Provisioning</h2>
              <p className="text-xs text-slate-500">Designated lead administrator for portal credential assignment</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Administrator Full Name *</label>
              <input
                type="text"
                name="adminName"
                value={formData.adminName}
                onChange={handleChange}
                placeholder="Dr. Rajeshwari Sharma"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Administrator Official Email *</label>
              <input
                type="email"
                name="adminEmail"
                value={formData.adminEmail}
                onChange={handleChange}
                placeholder="admin@hospital.org"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Administrator Mobile / Phone *</label>
              <input
                type="tel"
                name="adminPhone"
                value={formData.adminPhone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Password (Min 6 chars) *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="adminPassword"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full text-sm pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Submission Button */}
        <div className="text-center space-y-4 pt-2">
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto px-10 bg-royal-600 hover:bg-royal-700 text-white font-bold shadow-xl shadow-royal-600/25 text-base py-3"
            isLoading={isLoading}
          >
            Submit Hospital Registration Application <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <p className="text-xs text-slate-500">
            By applying, you confirm that your healthcare center operates in accordance with applicable medical council guidelines and healthcare standards.
          </p>
        </div>
      </form>
    </div>
  );
};
