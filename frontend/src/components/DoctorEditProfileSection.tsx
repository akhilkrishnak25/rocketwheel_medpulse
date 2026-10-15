import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Award,
  Stethoscope,
  Briefcase,
  IndianRupee,
  Languages,
  Clock,
  Calendar,
  Lock,
  CheckCircle2,
  AlertCircle,
  Camera,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Building2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useToast } from './ui/Toast';
import { doctorDashboardApi } from '../api/doctor.api';
import { uploadApi, getMediaUrl } from '../api/client';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

interface DoctorEditProfileSectionProps {
  profile: any;
  user: any;
  refetchProfile: () => void;
  updateUser: (u: any) => void;
}

export const DoctorEditProfileSection: React.FC<DoctorEditProfileSectionProps> = ({
  profile,
  user,
  refetchProfile,
  updateUser,
}) => {
  const toast = useToast();

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experienceYears, setExperienceYears] = useState<number>(5);
  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [languages, setLanguages] = useState('English, Hindi');
  const [about, setAbout] = useState('');
  const [workingDays, setWorkingDays] = useState('Mon,Tue,Wed,Thu,Fri,Sat');
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('17:00');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<number>(30);
  const [breakStart, setBreakStart] = useState('13:00');
  const [breakEnd, setBreakEnd] = useState('14:00');

  // Password Update Fields
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Photo State
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Prepopulate form fields whenever profile or user loads/changes
  useEffect(() => {
    if (profile) {
      setName(profile.name || user?.name || '');
      setEmail(profile.user?.email || user?.email || '');
      setPhone(profile.user?.phone || user?.phone || '');
      setQualification(profile.qualification || '');
      setSpecialization(profile.specialization || '');
      setExperienceYears(profile.experienceYears !== undefined ? Number(profile.experienceYears) : 5);
      setConsultationFee(profile.consultationFee !== undefined ? Number(profile.consultationFee) : 500);
      setLanguages(profile.languages || 'English, Hindi');
      setAbout(profile.about || '');
      setWorkingDays(profile.workingDays || 'Mon,Tue,Wed,Thu,Fri,Sat');
      setWorkingHoursStart(profile.workingHoursStart || '09:00');
      setWorkingHoursEnd(profile.workingHoursEnd || '17:00');
      setSlotDurationMinutes(profile.slotDurationMinutes || 30);
      setBreakStart(profile.breakStart || '13:00');
      setBreakEnd(profile.breakEnd || '14:00');
    } else if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [profile, user]);

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File Too Large', 'Please upload a photo smaller than 5 MB.');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          const result = await uploadApi.uploadProfilePhoto(base64Data);
          refetchProfile();
          updateUser({ avatarUrl: (result as any).url || (result as any).avatarUrl });
          toast.success('Photo Updated', 'Doctor profile photo has been updated.');
        } catch (err: any) {
          toast.error('Upload Failed', err.message || 'Failed to upload photo');
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploadingPhoto(false);
      toast.error('Upload Error', err.message);
    }
  };

  const handlePhotoRemove = async () => {
    if (!window.confirm('Remove doctor profile photo?')) return;
    try {
      await uploadApi.removeProfilePhoto();
      refetchProfile();
      updateUser({ avatarUrl: null });
      toast.success('Photo Removed', 'Profile photo removed successfully.');
    } catch (err: any) {
      toast.error('Removal Failed', err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validations
    if (!name.trim()) {
      toast.error('Validation Error', 'Full legal name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Validation Error', 'A valid email address is required.');
      return;
    }
    if (!phone.trim()) {
      toast.error('Validation Error', 'Contact mobile number is required.');
      return;
    }
    if (!qualification.trim()) {
      toast.error('Validation Error', 'Medical qualifications are required (e.g. MBBS, MD).');
      return;
    }
    if (!specialization.trim()) {
      toast.error('Validation Error', 'Clinical specialization is required.');
      return;
    }

    if (changePassword) {
      if (!newPassword || newPassword.length < 6) {
        toast.error('Password Too Short', 'New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('Password Mismatch', 'New password and confirmation do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        qualification: qualification.trim(),
        specialization: specialization.trim(),
        experienceYears: Number(experienceYears),
        consultationFee: Number(consultationFee),
        languages: languages.trim(),
        about: about.trim() || `Specialist in ${specialization.trim()} providing clinical OPD consultations.`,
        workingDays: workingDays.trim(),
        workingHoursStart: workingHoursStart.trim(),
        workingHoursEnd: workingHoursEnd.trim(),
        slotDurationMinutes: Number(slotDurationMinutes),
        breakStart: breakStart.trim() || null,
        breakEnd: breakEnd.trim() || null,
      };

      if (changePassword && newPassword.trim()) {
        payload.password = newPassword.trim();
      }

      const res = await doctorDashboardApi.updateProfile(payload);
      toast.success('Profile Saved', 'Your doctor details and credentials have been updated.');
      
      updateUser({
        name: res.name || name.trim(),
        email: res.user?.email || email.trim(),
        phone: res.user?.phone || phone.trim(),
        avatarUrl: res.photoUrl || user?.avatarUrl,
      });

      refetchProfile();

      // Reset password change fields
      setChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Save Failed', err.message || 'Could not update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const activePhoto = user?.avatarUrl || profile?.user?.avatarUrl || profile?.photoUrl;

  return (
    <div className="space-y-6">
      {/* Overview & Security Banner */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-sky-950">Accredited Doctor Profile Management</h3>
            <p className="text-xs text-sky-800">
              Update your personal, contact, clinical credentials, and practice timings. Sensitive data is protected with end-to-end server verification.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold"
            onClick={() => refetchProfile()}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1 text-royal-600" />
            Reload Profile
          </Button>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: PHOTO & INSTITUTIONAL AFFILIATION */}
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-slate-100 pb-6">
            {/* Avatar with Upload & Remove */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 rounded-2xl overflow-hidden bg-royal-50 border-2 border-royal-200 flex items-center justify-center text-royal-700 shadow-inner">
                {activePhoto ? (
                  <img
                    src={getMediaUrl(activePhoto)}
                    alt="Doctor Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80';
                    }}
                  />
                ) : (
                  <User className="w-14 h-14 text-royal-400" />
                )}
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-royal-600 animate-spin" />
                  </div>
                )}
              </div>

              <label
                htmlFor="edit-doctor-avatar-file-input"
                className="absolute -bottom-2 -right-2 p-2 bg-royal-600 hover:bg-royal-700 text-white rounded-xl shadow-md cursor-pointer transition-all hover:scale-105"
                title="Upload Profile Photo"
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  id="edit-doctor-avatar-file-input"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      handlePhotoUpload(files[0]);
                    }
                  }}
                  disabled={isUploadingPhoto}
                />
              </label>
            </div>

            {/* Identity & Status */}
            <div className="space-y-2 text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {name ? (name.startsWith('Dr.') ? name : `Dr. ${name}`) : 'Doctor Profile'}
                </h2>
                <Badge variant="success" className="text-xs font-bold py-0.5 px-2">
                  OPD Active
                </Badge>
              </div>
              <p className="text-xs font-semibold text-royal-600">
                {specialization || 'Clinical Specialist'} • {qualification || 'Medical Graduate'}
              </p>
              <p className="text-xs text-slate-500">
                Manage your credentials, consulting hours, and contact information. Changes are reflected across appointments and patient prescription headers immediately.
              </p>

              {activePhoto && (
                <div className="pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs text-rose-700 hover:text-rose-900 bg-rose-50 border border-rose-200 font-semibold"
                    onClick={handlePhotoRemove}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove Photo
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Read-Only Institutional Scope Badges */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Hospital Association & Affiliation (Read-Only)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <Building2 className="w-4 h-4 text-royal-600 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Hospital</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {profile?.hospital?.name || user?.hospital?.name || 'RocketWheel MedPulse Partner'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <Stethoscope className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Clinical Department</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {profile?.department?.name || 'General OPD'} ({profile?.department?.code || 'GEN'})
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-pink-600 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Account Authority</span>
                  <span className="font-bold text-slate-800 truncate block">
                    Accredited Doctor Portal
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Note: Institutional affiliations and departments are assigned directly by your Hospital Administrator.
            </p>
          </div>
        </Card>

        {/* SECTION 2: PERSONAL & CONTACT INFORMATION */}
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-royal-600" />
            <h3 className="font-bold text-sm text-slate-900">Personal & Contact Information</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Legal Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Anand Varma"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                  required
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Include Dr. prefix as desired</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Official Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor.email@hospital.org"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                  required
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Used for portal login and communications</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Contact Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                  required
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">For clinical escalation and notifications</span>
            </div>
          </div>
        </Card>

        {/* SECTION 3: PROFESSIONAL QUALIFICATIONS & CLINICAL DETAILS */}
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Professional Qualifications & Clinical Details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Medical Qualifications <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="e.g. MBBS, MD (Internal Medicine), DM (Cardiology)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Clinical Specialization <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="e.g. Interventional Cardiology"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Experience (Years)</label>
              <input
                type="number"
                min={0}
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Consultation Fee (₹)</label>
              <input
                type="number"
                min={0}
                value={consultationFee}
                onChange={(e) => setConsultationFee(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Languages Spoken</label>
              <input
                type="text"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="e.g. English, Hindi, Bengali"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Professional Bio & Clinical Philosophy <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Brief summary of clinical achievements, subspecialties, and patient care philosophy..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
            />
          </div>
        </Card>

        {/* SECTION 4: PRACTICE SCHEDULE & CONSULTATION TIMINGS */}
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-900">Practice Timings & Consultation Settings</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Consulting Working Days</label>
              <input
                type="text"
                value={workingDays}
                onChange={(e) => setWorkingDays(e.target.value)}
                placeholder="Mon,Tue,Wed,Thu,Fri,Sat"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Comma-separated days of availability</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Slot Duration (Minutes)</label>
              <select
                value={slotDurationMinutes}
                onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              >
                <option value={10}>10 Minutes / Patient</option>
                <option value={15}>15 Minutes / Patient</option>
                <option value={20}>20 Minutes / Patient</option>
                <option value={30}>30 Minutes / Patient</option>
                <option value={45}>45 Minutes / Patient</option>
                <option value={60}>60 Minutes / Patient</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">OPD Hours Start</label>
              <input
                type="time"
                value={workingHoursStart}
                onChange={(e) => setWorkingHoursStart(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">OPD Hours End</label>
              <input
                type="time"
                value={workingHoursEnd}
                onChange={(e) => setWorkingHoursEnd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Break Start Time</label>
              <input
                type="time"
                value={breakStart}
                onChange={(e) => setBreakStart(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Break End Time</label>
              <input
                type="time"
                value={breakEnd}
                onChange={(e) => setBreakEnd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
              />
            </div>
          </div>
        </Card>

        {/* SECTION 5: ACCOUNT SECURITY & PASSWORD UPDATE */}
        <Card className="rounded-2xl border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Account Security & Password</h3>
                <p className="text-[11px] text-slate-500">
                  Update your doctor portal password. Passwords are never displayed in plain text.
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`font-semibold text-xs ${
                changePassword
                  ? 'bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100'
                  : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
              onClick={() => {
                setChangePassword(!changePassword);
                if (changePassword) {
                  setNewPassword('');
                  setConfirmPassword('');
                }
              }}
            >
              {changePassword ? 'Cancel Password Change' : 'Change Password'}
            </Button>
          </div>

          {changePassword ? (
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950">Set New Portal Login Password</span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? 'Hide Password' : 'Show Password'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="text-[11px] text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Password must be at least 6 characters long. For security, your current password is never exposed.
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Your doctor account credentials are secure. Click <strong>Change Password</strong> above if you wish to set a new password.
            </p>
          )}
        </Card>

        {/* SUBMIT BUTTON BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Verify all updated clinical credentials and consulting timings before saving.
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold"
              onClick={() => refetchProfile()}
              disabled={isSaving}
            >
              Reset Changes
            </Button>
            <Button
              type="submit"
              size="md"
              className="bg-royal-600 hover:bg-royal-700 text-white font-bold px-6 shadow-md shadow-royal-600/20"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin text-white" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2 text-white" />
                  Save Doctor Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
