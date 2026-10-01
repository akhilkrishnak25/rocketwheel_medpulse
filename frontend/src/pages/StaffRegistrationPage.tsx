import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Stethoscope,
  FlaskConical,
  ShoppingBag,
  Activity,
  CheckCircle2,
  Building2,
  Lock,
  Mail,
  Phone,
  User,
  AlertCircle,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import { authApi } from '../api/auth.api';
import { hospitalsApi } from '../api/hospitals.api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

export const StaffRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [activeRole, setActiveRole] = useState<'DOCTOR' | 'SUPPORT_STAFF' | 'LAB' | 'PHARMACY'>('DOCTOR');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Common Hospital List Query
  const { data: hospitals } = useQuery({
    queryKey: ['public-hospitals'],
    queryFn: () => hospitalsApi.getAll(),
  });

  // Doctor Form State
  const [docName, setDocName] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [docHospitalId, setDocHospitalId] = useState('');
  const [docDepartmentId, setDocDepartmentId] = useState('');
  const [docQualification, setDocQualification] = useState('');
  const [docSpecialization, setDocSpecialization] = useState('');
  const [docExperience, setDocExperience] = useState(5);
  const [docFee, setDocFee] = useState(500);

  // Fetch departments for selected doctor hospital
  const { data: hospitalDetails } = useQuery({
    queryKey: ['hospital-details-for-doc', docHospitalId],
    queryFn: () => hospitalsApi.getById(docHospitalId),
    enabled: !!docHospitalId,
  });

  // Support Staff Form State
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffHospitalId, setStaffHospitalId] = useState('');
  const [staffRoleTitle, setStaffRoleTitle] = useState('Triage & Screening Nurse');
  const [staffDepartment, setStaffDepartment] = useState('Outpatient Department (OPD)');

  // Lab Form State
  const [labName, setLabName] = useState('');
  const [labLicense, setLabLicense] = useState('');
  const [labType, setLabType] = useState<'INDEPENDENT' | 'HOSPITAL_ASSOCIATED'>('INDEPENDENT');
  const [labHospitalId, setLabHospitalId] = useState('');
  const [labEmail, setLabEmail] = useState('');
  const [labPassword, setLabPassword] = useState('');
  const [labContactPerson, setLabContactPerson] = useState('');
  const [labPhone, setLabPhone] = useState('');
  const [labAddress, setLabAddress] = useState('');
  const [labCity, setLabCity] = useState('');
  const [labState, setLabState] = useState('');
  const [labPincode, setLabPincode] = useState('');

  // Pharmacy Form State
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyLicense, setPharmacyLicense] = useState('');
  const [pharmacyHospitalId, setPharmacyHospitalId] = useState('');
  const [pharmacyEmail, setPharmacyEmail] = useState('');
  const [pharmacyPassword, setPharmacyPassword] = useState('');
  const [pharmacyContactPerson, setPharmacyContactPerson] = useState('');
  const [pharmacyPhone, setPharmacyPhone] = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');

  // Doctor Mutation
  const doctorMutation = useMutation({
    mutationFn: (data: any) => authApi.registerDoctor(data),
    onSuccess: (res) => {
      setSuccessMessage(res?.message || 'Doctor application submitted successfully for hospital administrator review.');
    },
    onError: (err: any) => toast.error('Registration Failed', err.message),
  });

  // Staff Mutation
  const staffMutation = useMutation({
    mutationFn: (data: any) => authApi.registerSupportStaff(data),
    onSuccess: (res) => {
      setSuccessMessage(res?.message || 'Support staff application submitted for hospital administrator verification.');
    },
    onError: (err: any) => toast.error('Registration Failed', err.message),
  });

  // Lab Mutation
  const labMutation = useMutation({
    mutationFn: (data: any) => authApi.registerLab(data),
    onSuccess: (res) => {
      setSuccessMessage(res?.message || 'Diagnostic laboratory application submitted for platform accreditation review.');
    },
    onError: (err: any) => toast.error('Registration Failed', err.message),
  });

  // Pharmacy Mutation
  const pharmacyMutation = useMutation({
    mutationFn: (data: any) => authApi.registerPharmacy(data),
    onSuccess: (res) => {
      setSuccessMessage(res?.message || 'Pharmacy staff account created and registered successfully.');
    },
    onError: (err: any) => toast.error('Registration Failed', err.message),
  });

  if (successMessage) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <Card className="rounded-3xl p-8 text-center space-y-4 shadow-xl border-slate-200">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Application Submitted Successfully
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            {successMessage}
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <Link to="/staff/login">
              <Button size="md" className="bg-royal-600 hover:bg-royal-700 font-bold">
                Go to Staff Login
              </Button>
            </Link>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setSuccessMessage(null);
              }}
            >
              Register Another Account
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
      <div className="text-center space-y-2">
        <Link to="/" className="inline-block mb-1">
          <RocketWheelLogo size="md" />
        </Link>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Clinical & Operational Self-Registration
        </h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Register your professional profile as a Doctor, Support Staff, Diagnostic Lab, or In-house Pharmacy
        </p>
      </div>

      {/* Role Picker Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-200/80 p-1.5 rounded-2xl text-xs font-bold">
        <button
          onClick={() => setActiveRole('DOCTOR')}
          className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeRole === 'DOCTOR' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Stethoscope className="w-4 h-4 text-pink-600" />
          Doctor
        </button>

        <button
          onClick={() => setActiveRole('SUPPORT_STAFF')}
          className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeRole === 'SUPPORT_STAFF' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4 text-teal-600" />
          Support Staff
        </button>

        <button
          onClick={() => setActiveRole('LAB')}
          className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeRole === 'LAB' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FlaskConical className="w-4 h-4 text-purple-600" />
          Diagnostic Lab
        </button>

        <button
          onClick={() => setActiveRole('PHARMACY')}
          className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeRole === 'PHARMACY' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-emerald-600" />
          Pharmacy
        </button>
      </div>

      <Card className="rounded-3xl p-6 sm:p-8 border-slate-200 shadow-xl">
        {/* DOCTOR REGISTRATION FORM */}
        {activeRole === 'DOCTOR' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!docHospitalId || !docDepartmentId) {
                toast.error('Hospital & Department Required', 'Please select a hospital and clinical department.');
                return;
              }
              doctorMutation.mutate({
                name: docName.trim(),
                email: docEmail.trim(),
                password: docPassword,
                phone: docPhone.trim(),
                hospitalId: docHospitalId,
                departmentId: docDepartmentId,
                qualification: docQualification.trim(),
                specialization: docSpecialization.trim(),
                experienceYears: Number(docExperience),
                consultationFee: Number(docFee),
              });
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-3 bg-pink-50 border border-pink-200 rounded-xl text-pink-900 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-pink-600 shrink-0" />
              <span>
                Doctor registrations are verified by the Hospital Administrator before activation in OPD rosters.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Legal Name (with Dr. prefix) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Dr. Anand Varma"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={docEmail}
                  onChange={(e) => setDocEmail(e.target.value)}
                  placeholder="anand.varma@hospital.org"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={docPassword}
                  onChange={(e) => setDocPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={docPhone}
                  onChange={(e) => setDocPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hospital Affiliation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={docHospitalId}
                  onChange={(e) => {
                    setDocHospitalId(e.target.value);
                    setDocDepartmentId('');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  required
                >
                  <option value="">Select hospital facility...</option>
                  {(hospitals || []).map((h: any) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department <span className="text-rose-500">*</span>
                </label>
                <select
                  value={docDepartmentId}
                  onChange={(e) => setDocDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  required
                  disabled={!docHospitalId}
                >
                  <option value="">Select department...</option>
                  {(hospitalDetails?.departments || []).map((dept: any) => (
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
                  Qualifications <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={docQualification}
                  onChange={(e) => setDocQualification(e.target.value)}
                  placeholder="MBBS, MD (Medicine), DM (Cardio)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Specialization <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={docSpecialization}
                  onChange={(e) => setDocSpecialization(e.target.value)}
                  placeholder="Interventional Cardiology"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Experience (Years)</label>
                <input
                  type="number"
                  value={docExperience}
                  onChange={(e) => setDocExperience(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Consultation Fee (₹)</label>
                <input
                  type="number"
                  value={docFee}
                  onChange={(e) => setDocFee(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="md"
              className="w-full bg-royal-600 hover:bg-royal-700 font-bold"
              isLoading={doctorMutation.isPending}
            >
              Submit Doctor Registration
            </Button>
          </form>
        )}

        {/* SUPPORT STAFF REGISTRATION FORM */}
        {activeRole === 'SUPPORT_STAFF' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!staffHospitalId) {
                toast.error('Hospital Required', 'Please select your hospital facility.');
                return;
              }
              staffMutation.mutate({
                name: staffName.trim(),
                email: staffEmail.trim(),
                password: staffPassword,
                phone: staffPhone.trim(),
                hospitalId: staffHospitalId,
                roleTitle: staffRoleTitle.trim(),
                department: staffDepartment.trim(),
              });
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                Support staff accounts are approved by the Hospital Administrator before vitals recording is enabled.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Nurse Sunita Sharma"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="sunita@hospital.org"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Hospital Facility <span className="text-rose-500">*</span>
              </label>
              <select
                value={staffHospitalId}
                onChange={(e) => setStaffHospitalId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                required
              >
                <option value="">Select hospital facility...</option>
                {(hospitals || []).map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.city})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Designation</label>
                <input
                  type="text"
                  value={staffRoleTitle}
                  onChange={(e) => setStaffRoleTitle(e.target.value)}
                  placeholder="Triage & Screening Nurse"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={staffDepartment}
                  onChange={(e) => setStaffDepartment(e.target.value)}
                  placeholder="Outpatient Department (OPD)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="md"
              className="w-full bg-teal-600 hover:bg-teal-700 font-bold"
              isLoading={staffMutation.isPending}
            >
              Submit Support Staff Registration
            </Button>
          </form>
        )}

        {/* DIAGNOSTIC LAB REGISTRATION FORM */}
        {activeRole === 'LAB' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              labMutation.mutate({
                name: labName.trim(),
                licenseNumber: labLicense.trim(),
                type: labType,
                hospitalId: labType === 'HOSPITAL_ASSOCIATED' ? labHospitalId : undefined,
                email: labEmail.trim(),
                password: labPassword,
                contactPerson: labContactPerson.trim(),
                phone: labPhone.trim(),
                address: labAddress.trim(),
                city: labCity.trim(),
                state: labState.trim(),
                pincode: labPincode.trim(),
              });
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                Independent laboratories undergo accreditation verification by the Platform Super Administrator.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Diagnostic Laboratory Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  placeholder="e.g. Apex Clinical Diagnostics"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Diagnostic License / NABL Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={labLicense}
                  onChange={(e) => setLabLicense(e.target.value)}
                  placeholder="NABL-12345 / DLS-889"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Laboratory Type</label>
                <select
                  value={labType}
                  onChange={(e) => setLabType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="INDEPENDENT">Independent Laboratory Center</option>
                  <option value="HOSPITAL_ASSOCIATED">Hospital-Associated Laboratory</option>
                </select>
              </div>

              {labType === 'HOSPITAL_ASSOCIATED' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Associated Hospital <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={labHospitalId}
                    onChange={(e) => setLabHospitalId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                    required
                  >
                    <option value="">Select hospital...</option>
                    {(hospitals || []).map((h: any) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={labEmail}
                  onChange={(e) => setLabEmail(e.target.value)}
                  placeholder="reports@apexdiagnostics.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Portal Login Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={labPassword}
                  onChange={(e) => setLabPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contact Person / Chief Pathologist <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={labContactPerson}
                  onChange={(e) => setLabContactPerson(e.target.value)}
                  placeholder="Dr. K. S. Rao"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={labPhone}
                  onChange={(e) => setLabPhone(e.target.value)}
                  placeholder="+91 40 2345 6789"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Physical Address</label>
              <input
                type="text"
                value={labAddress}
                onChange={(e) => setLabAddress(e.target.value)}
                placeholder="Diagnostic Centre, Road No. 12, Banjara Hills"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={labCity}
                  onChange={(e) => setLabCity(e.target.value)}
                  placeholder="Hyderabad"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={labState}
                  onChange={(e) => setLabState(e.target.value)}
                  placeholder="Telangana"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pincode</label>
                <input
                  type="text"
                  value={labPincode}
                  onChange={(e) => setLabPincode(e.target.value)}
                  placeholder="500034"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              size="md"
              className="w-full bg-purple-600 hover:bg-purple-700 font-bold"
              isLoading={labMutation.isPending}
            >
              Submit Laboratory Registration
            </Button>
          </form>
        )}

        {/* PHARMACY REGISTRATION FORM */}
        {activeRole === 'PHARMACY' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pharmacyHospitalId) {
                toast.error('Hospital Required', 'Please select associated hospital facility.');
                return;
              }
              pharmacyMutation.mutate({
                name: pharmacyName.trim(),
                licenseNumber: pharmacyLicense.trim(),
                hospitalId: pharmacyHospitalId,
                email: pharmacyEmail.trim(),
                password: pharmacyPassword,
                contactPerson: pharmacyContactPerson.trim(),
                phone: pharmacyPhone.trim(),
                address: pharmacyAddress.trim(),
              });
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Hospital pharmacies receive electronic prescriptions directly from OPD doctor consultation rooms.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pharmacy Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  placeholder="Apollo MedPlus Pharmacy"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Drug Dispensing License Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={pharmacyLicense}
                  onChange={(e) => setPharmacyLicense(e.target.value)}
                  placeholder="DL-20B/12345"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Associated Hospital Facility <span className="text-rose-500">*</span>
              </label>
              <select
                value={pharmacyHospitalId}
                onChange={(e) => setPharmacyHospitalId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                required
              >
                <option value="">Select hospital facility...</option>
                {(hospitals || []).map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.city})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={pharmacyEmail}
                  onChange={(e) => setPharmacyEmail(e.target.value)}
                  placeholder="pharmacy@hospital.org"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Login Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={pharmacyPassword}
                  onChange={(e) => setPharmacyPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Registered Pharmacist / Contact Person <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={pharmacyContactPerson}
                  onChange={(e) => setPharmacyContactPerson(e.target.value)}
                  placeholder="Mr. V. K. Gupta (B.Pharm)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contact Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={pharmacyPhone}
                  onChange={(e) => setPharmacyPhone(e.target.value)}
                  placeholder="+91 40 2345 9999"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pharmacy Location / Counter Details</label>
              <input
                type="text"
                value={pharmacyAddress}
                onChange={(e) => setPharmacyAddress(e.target.value)}
                placeholder="Ground Floor, OPD Wing, Block A"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                required
              />
            </div>

            <Button
              type="submit"
              size="md"
              className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold"
              isLoading={pharmacyMutation.isPending}
            >
              Submit Pharmacy Registration
            </Button>
          </form>
        )}
      </Card>

      <div className="text-center text-xs text-slate-500">
        Already registered?{' '}
        <Link to="/staff/login" className="text-royal-600 font-bold hover:underline">
          Sign In to Staff & Clinical Portal
        </Link>
      </div>
    </div>
  );
};
