import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileImage,
  Upload,
  Check,
  Building2,
  FileText,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { doctorDashboardApi } from '../api/doctor.api';
import { uploadApi, getMediaUrl } from '../api/client';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { InlineSpinner } from './ui/Loading';
import { useToast } from './ui/Toast';

interface DoctorLetterheadBrandingSectionProps {
  user: any;
  profile?: any;
  refetchProfile?: () => void;
}

export const DoctorLetterheadBrandingSection: React.FC<DoctorLetterheadBrandingSectionProps> = ({
  user,
  profile,
  refetchProfile,
}) => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [footerImageUrl, setFooterImageUrl] = useState<string | null>(null);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [isUploadingFooter, setIsUploadingFooter] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current Doctor Branding and Hospital Fallback Branding
  const { data: brandingData, isLoading, refetch } = useQuery({
    queryKey: ['doctor-branding'],
    queryFn: async () => {
      const res = await doctorDashboardApi.getBranding();
      return res;
    },
  });

  // Sync state when data is loaded
  useEffect(() => {
    if (brandingData) {
      setHeaderImageUrl(brandingData.headerImageUrl || null);
      setFooterImageUrl(brandingData.footerImageUrl || null);
      setHasChanges(false);
    }
  }, [brandingData]);

  // Mutation to persist doctor branding changes
  const saveBrandingMutation = useMutation({
    mutationFn: async (payload: { headerImageUrl: string | null; footerImageUrl: string | null }) => {
      return await doctorDashboardApi.updateBranding(payload);
    },
    onSuccess: () => {
      toast.success('Doctor letterhead branding updated successfully');
      setHasChanges(false);
      refetch();
      if (refetchProfile) refetchProfile();
      queryClient.invalidateQueries({ queryKey: ['doctor-branding'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-profile'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update letterhead branding');
    },
  });

  // Handle Header Image File Upload
  const handleUploadHeader = async (file: File) => {
    if (!file) return;

    // Validate type (PNG, JPG, JPEG)
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error('Only PNG, JPG, and JPEG image formats are supported');
      return;
    }

    // Validate size (max 8MB)
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Header image size must not exceed 8MB');
      return;
    }

    try {
      setIsUploadingHeader(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await uploadApi.uploadDoctorAsset(base64Data, 'header');
          if (res?.url) {
            setHeaderImageUrl(res.url);
            setHasChanges(true);
            toast.success('Doctor custom header image uploaded');
          }
        } catch (uploadErr: any) {
          toast.error(uploadErr.message || 'Failed to upload header image');
        } finally {
          setIsUploadingHeader(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploadingHeader(false);
      toast.error(err.message || 'Error processing header image');
    }
  };

  // Handle Footer Image File Upload
  const handleUploadFooter = async (file: File) => {
    if (!file) return;

    // Validate type (PNG, JPG, JPEG)
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error('Only PNG, JPG, and JPEG image formats are supported');
      return;
    }

    // Validate size (max 8MB)
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Footer image size must not exceed 8MB');
      return;
    }

    try {
      setIsUploadingFooter(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await uploadApi.uploadDoctorAsset(base64Data, 'footer');
          if (res?.url) {
            setFooterImageUrl(res.url);
            setHasChanges(true);
            toast.success('Doctor custom footer image uploaded');
          }
        } catch (uploadErr: any) {
          toast.error(uploadErr.message || 'Failed to upload footer image');
        } finally {
          setIsUploadingFooter(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploadingFooter(false);
      toast.error(err.message || 'Error processing footer image');
    }
  };

  // Remove Doctor custom header image (reset to hospital fallback)
  const handleRemoveHeader = () => {
    setHeaderImageUrl(null);
    setHasChanges(true);
    toast.info('Custom header removed. Hospital header fallback will now be used.');
  };

  // Remove Doctor custom footer image (reset to hospital fallback)
  const handleRemoveFooter = () => {
    setFooterImageUrl(null);
    setHasChanges(true);
    toast.info('Custom footer removed. Hospital footer fallback will now be used.');
  };

  // Save changes
  const handleSaveAll = () => {
    saveBrandingMutation.mutate({
      headerImageUrl: headerImageUrl || null,
      footerImageUrl: footerImageUrl || null,
    });
  };

  const hospitalBranding = brandingData?.hospitalBranding;
  const hospitalName = brandingData?.hospitalName || 'RocketWheel Hospital';
  const rawDoctorName = brandingData?.doctorName || user?.name || 'Dr. Specialist';
  const cleanDoctorName = rawDoctorName.trim().replace(/^(dr\.?|doctor)\s+/i, '');
  const doctorName = `Dr. ${cleanDoctorName || 'Specialist'}`;

  // Fallback detection
  const hasDoctorHeader = Boolean(headerImageUrl);
  const hasHospitalHeader = Boolean(hospitalBranding?.headerImageUrl);
  const effectiveHeaderUrl = headerImageUrl || hospitalBranding?.headerImageUrl || null;

  const hasDoctorFooter = Boolean(footerImageUrl);
  const hasHospitalFooter = Boolean(hospitalBranding?.footerImageUrl);
  const effectiveFooterUrl = footerImageUrl || hospitalBranding?.footerImageUrl || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <InlineSpinner size="lg" className="text-royal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileImage className="w-5 h-5 text-indigo-600" />
              Doctor Consultation Letterhead & Branding
            </h2>
            <Badge variant="purple" className="text-[10px] font-bold">
              Doctor-Wise Isolation
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Configure your personalized consultation letterhead. Your custom header and footer images appear on every
            clinical consultation PDF you generate. If no custom image is configured, the system automatically falls
            back to the hospital letterhead.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setHeaderImageUrl(brandingData?.headerImageUrl || null);
                setFooterImageUrl(brandingData?.footerImageUrl || null);
                setHasChanges(false);
              }}
              className="text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Discard Changes
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleSaveAll}
            isLoading={saveBrandingMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Letterhead Branding
          </Button>
        </div>
      </div>

      {/* Main Grid: Upload Cards (Left 7 cols) & Live PDF Preview (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Image Controls & Fallback Information */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. DOCTOR HEADER IMAGE CARD */}
          <Card className="rounded-2xl border-slate-200 shadow-xs p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Doctor Header Image
                </h3>
                <p className="text-[11px] text-slate-500">
                  Custom top banner for clinical consultation PDFs (Preserves aspect ratio; PNG, JPG, JPEG up to 8MB)
                </p>
              </div>

              {hasDoctorHeader ? (
                <Badge variant="success" className="text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Doctor Custom
                </Badge>
              ) : hasHospitalHeader ? (
                <Badge variant="warning" className="text-[10px] font-bold flex items-center gap-1">
                  <Info className="w-3 h-3" /> Hospital Fallback
                </Badge>
              ) : (
                <Badge variant="default" className="text-[10px] font-bold">
                  Text Header
                </Badge>
              )}
            </div>

            {hasDoctorHeader ? (
              <div className="space-y-3">
                <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-2 overflow-hidden flex items-center justify-center min-h-[100px] max-h-[160px]">
                  <img
                    src={getMediaUrl(headerImageUrl)}
                    alt="Doctor Custom Header"
                    className="max-h-[140px] w-auto max-w-full object-contain rounded"
                  />
                  {isUploadingHeader && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                      <InlineSpinner size="md" className="text-indigo-600" />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Doctor Custom Header Configured
                  </span>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="doctor-header-image-input"
                      accept="image/png, image/jpeg, image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadHeader(e.target.files[0]);
                        }
                      }}
                      disabled={isUploadingHeader}
                    />
                    <label
                      htmlFor="doctor-header-image-input"
                      className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                    >
                      {isUploadingHeader ? (
                        <InlineSpinner size="sm" className="mr-1.5" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                      )}
                      Replace Header Image
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveHeader}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                    >
                      Remove / Use Fallback
                    </button>
                  </div>
                </div>
              </div>
            ) : hasHospitalHeader ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Currently using Hospital Admin's Header Image (Automatic Fallback)
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium">Hospital Letterhead</span>
                  </div>
                  <div className="relative rounded-lg border border-amber-200/80 bg-white p-2 overflow-hidden flex items-center justify-center min-h-[80px] max-h-[120px]">
                    <img
                      src={getMediaUrl(hospitalBranding?.headerImageUrl)}
                      alt="Hospital Header Fallback"
                      className="max-h-[100px] w-auto max-w-full object-contain rounded opacity-80"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-500">
                    Upload your own header image to customize your prescription letterhead.
                  </p>
                  <input
                    type="file"
                    id="doctor-header-image-upload-fallback"
                    accept="image/png, image/jpeg, image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadHeader(e.target.files[0]);
                      }
                    }}
                    disabled={isUploadingHeader}
                  />
                  <label
                    htmlFor="doctor-header-image-upload-fallback"
                    className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs transition-colors"
                  >
                    {isUploadingHeader ? (
                      <InlineSpinner size="sm" className="mr-1.5 text-white" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Upload Custom Header
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-6 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl bg-slate-50/50 hover:bg-slate-50 text-center transition-all">
                <input
                  type="file"
                  id="doctor-header-image-input-new"
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadHeader(e.target.files[0]);
                    }
                  }}
                  disabled={isUploadingHeader}
                />
                <label htmlFor="doctor-header-image-input-new" className="cursor-pointer flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                    {isUploadingHeader ? <InlineSpinner size="md" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {isUploadingHeader ? 'Uploading Doctor Header...' : 'Click to Upload Doctor Header Image'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Supports PNG, JPG, and JPEG formats (Max 8MB)
                  </span>
                </label>
              </div>
            )}
          </Card>

          {/* 2. DOCTOR FOOTER IMAGE CARD */}
          <Card className="rounded-2xl border-slate-200 shadow-xs p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Doctor Footer Image
                </h3>
                <p className="text-[11px] text-slate-500">
                  Custom bottom banner or clinic disclaimer image (Appears at bottom of every PDF page preserving aspect ratio)
                </p>
              </div>

              {hasDoctorFooter ? (
                <Badge variant="success" className="text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Doctor Custom
                </Badge>
              ) : hasHospitalFooter ? (
                <Badge variant="warning" className="text-[10px] font-bold flex items-center gap-1">
                  <Info className="w-3 h-3" /> Hospital Fallback
                </Badge>
              ) : (
                <Badge variant="default" className="text-[10px] font-bold">
                  Text Footer
                </Badge>
              )}
            </div>

            {hasDoctorFooter ? (
              <div className="space-y-3">
                <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-2 overflow-hidden flex items-center justify-center min-h-[80px] max-h-[140px]">
                  <img
                    src={getMediaUrl(footerImageUrl)}
                    alt="Doctor Custom Footer"
                    className="max-h-[120px] w-auto max-w-full object-contain rounded"
                  />
                  {isUploadingFooter && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                      <InlineSpinner size="md" className="text-emerald-600" />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Doctor Custom Footer Configured
                  </span>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="doctor-footer-image-input"
                      accept="image/png, image/jpeg, image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadFooter(e.target.files[0]);
                        }
                      }}
                      disabled={isUploadingFooter}
                    />
                    <label
                      htmlFor="doctor-footer-image-input"
                      className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                    >
                      {isUploadingFooter ? (
                        <InlineSpinner size="sm" className="mr-1.5" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      )}
                      Replace Footer Image
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveFooter}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                    >
                      Remove / Use Fallback
                    </button>
                  </div>
                </div>
              </div>
            ) : hasHospitalFooter ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Currently using Hospital Admin's Footer Image (Automatic Fallback)
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium">Hospital Letterhead</span>
                  </div>
                  <div className="relative rounded-lg border border-amber-200/80 bg-white p-2 overflow-hidden flex items-center justify-center min-h-[60px] max-h-[100px]">
                    <img
                      src={getMediaUrl(hospitalBranding?.footerImageUrl)}
                      alt="Hospital Footer Fallback"
                      className="max-h-[80px] w-auto max-w-full object-contain rounded opacity-80"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-500">
                    Upload your own footer image to override the hospital footer on your consultation PDFs.
                  </p>
                  <input
                    type="file"
                    id="doctor-footer-image-upload-fallback"
                    accept="image/png, image/jpeg, image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadFooter(e.target.files[0]);
                      }
                    }}
                    disabled={isUploadingFooter}
                  />
                  <label
                    htmlFor="doctor-footer-image-upload-fallback"
                    className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs transition-colors"
                  >
                    {isUploadingFooter ? (
                      <InlineSpinner size="sm" className="mr-1.5 text-white" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Upload Custom Footer
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-6 border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl bg-slate-50/50 hover:bg-slate-50 text-center transition-all">
                <input
                  type="file"
                  id="doctor-footer-image-input-new"
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadFooter(e.target.files[0]);
                    }
                  }}
                  disabled={isUploadingFooter}
                />
                <label htmlFor="doctor-footer-image-input-new" className="cursor-pointer flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                    {isUploadingFooter ? <InlineSpinner size="md" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {isUploadingFooter ? 'Uploading Doctor Footer...' : 'Click to Upload Doctor Footer Image'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Supports PNG, JPG, and JPEG formats (Max 8MB)
                  </span>
                </label>
              </div>
            )}
          </Card>

          {/* 3. THREE-TIER FALLBACK LOGIC REFERENCE CARD */}
          <Card className="rounded-2xl border-slate-200 bg-slate-50/50 shadow-xs p-5 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Automated Consultation PDF Branding & Fallback Rules
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-indigo-700 flex items-center gap-1">
                  1. Doctor Custom Images
                </span>
                <p className="text-slate-500">
                  Priority 1: Your uploaded header and footer images take immediate precedence on all your generated PDFs.
                </p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-amber-700 flex items-center gap-1">
                  2. Hospital Admin Fallback
                </span>
                <p className="text-slate-500">
                  Priority 2: If you haven't uploaded an image, the hospital's official letterhead images are automatically used.
                </p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  3. Clean Standard Layout
                </span>
                <p className="text-slate-500">
                  Priority 3: If neither doctor nor hospital images are present, the PDF renders cleanly with formatted text.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Live A4 Document Simulation Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Eye className="w-4 h-4 text-royal-600" />
              Live A4 Consultation PDF Layout
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono">
              210mm × 297mm (A4)
            </Badge>
          </div>

          {/* Simulated A4 Paper */}
          <div className="relative bg-white border border-slate-300 rounded-xl shadow-lg p-5 aspect-[210/297] flex flex-col justify-between overflow-hidden select-none">
            {/* Watermark overlay if enabled by hospital */}
            {hospitalBranding?.watermarkEnabled && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                style={{
                  opacity: hospitalBranding?.watermarkOpacity || 0.08,
                  transform: `rotate(${hospitalBranding?.watermarkRotation || -30}deg)`,
                }}
              >
                {hospitalBranding.watermarkType === 'IMAGE' && hospitalBranding.watermarkImageUrl ? (
                  <img
                    src={getMediaUrl(hospitalBranding.watermarkImageUrl)}
                    alt="Watermark"
                    className="max-w-[180px] max-h-[180px] object-contain filter grayscale"
                  />
                ) : (
                  <span className="font-black text-2xl tracking-widest text-slate-800 uppercase text-center border-4 border-slate-800 p-3 rounded-lg">
                    {hospitalBranding.watermarkText || hospitalName}
                  </span>
                )}
              </div>
            )}

            {/* TOP HEADER AREA */}
            <div className="border-b border-slate-200 pb-2">
              {effectiveHeaderUrl ? (
                <div className="flex flex-col items-center">
                  <img
                    src={getMediaUrl(effectiveHeaderUrl)}
                    alt="Consultation Header"
                    className="max-h-[60px] w-auto max-w-full object-contain"
                  />
                  <div className="mt-1 flex items-center gap-1.5">
                    {hasDoctorHeader ? (
                      <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                        Doctor Custom Header
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        Hospital Header Fallback
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-[12px] text-slate-900 tracking-tight">{hospitalName}</h4>
                    <p className="text-[8px] text-slate-500">Multi-Specialty OPD & Clinical Center</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-indigo-700">{doctorName}</span>
                    <p className="text-[8px] text-slate-500">Consultant Physician</p>
                  </div>
                </div>
              )}
            </div>

            {/* SAMPLE CONSULTATION CONTENT BODY */}
            <div className="flex-1 py-3 space-y-2 text-[8px] text-slate-700">
              {/* Patient Info Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded p-1.5 flex items-center justify-between text-[7.5px]">
                <div>
                  <span className="font-bold text-slate-900">Patient: </span>
                  <span>Rahul Sharma (34 / M)</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">OP No: </span>
                  <span className="font-mono">OP-2026-0891</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">Date: </span>
                  <span>{new Date().toISOString().split('T')[0]}</span>
                </div>
              </div>

              {/* Vitals Summary */}
              <div className="grid grid-cols-4 gap-1 text-center text-[7px] py-1 bg-royal-50/50 rounded border border-royal-100">
                <div>
                  <span className="text-slate-400 block">BP</span>
                  <span className="font-bold text-slate-800">120/80 mmHg</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Pulse</span>
                  <span className="font-bold text-slate-800">74 bpm</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Temp</span>
                  <span className="font-bold text-slate-800">98.6 °F</span>
                </div>
                <div>
                  <span className="text-slate-400 block">SpO2</span>
                  <span className="font-bold text-slate-800">99%</span>
                </div>
              </div>

              {/* Diagnosis */}
              <div>
                <span className="font-bold text-slate-900 uppercase tracking-wider block text-[7.5px] border-b border-slate-100 pb-0.5">
                  Clinical Diagnosis
                </span>
                <p className="text-slate-600 mt-0.5 italic">Acute Upper Respiratory Tract Infection (URTI) with mild pyrexia</p>
              </div>

              {/* Medicines Sample Table */}
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-[7px] text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-1.5 py-0.5">#</th>
                      <th className="px-1.5 py-0.5">Medicine</th>
                      <th className="px-1.5 py-0.5">Dosage</th>
                      <th className="px-1.5 py-0.5">Freq</th>
                      <th className="px-1.5 py-0.5">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr>
                      <td className="px-1.5 py-0.5 font-bold">1</td>
                      <td className="px-1.5 py-0.5 font-semibold text-slate-900">Tab. Paracetamol 650mg</td>
                      <td className="px-1.5 py-0.5">1 Tab</td>
                      <td className="px-1.5 py-0.5">1-0-1</td>
                      <td className="px-1.5 py-0.5">3 Days</td>
                    </tr>
                    <tr>
                      <td className="px-1.5 py-0.5 font-bold">2</td>
                      <td className="px-1.5 py-0.5 font-semibold text-slate-900">Tab. Cetirizine 10mg</td>
                      <td className="px-1.5 py-0.5">1 Tab</td>
                      <td className="px-1.5 py-0.5">0-0-1</td>
                      <td className="px-1.5 py-0.5">5 Days</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Follow-up Review Date */}
              <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1 flex items-center justify-between text-[7px]">
                <span className="font-bold text-royal-700">FOLLOW-UP REVIEW DATE:</span>
                <span className="font-bold text-slate-800">02/11/2026</span>
              </div>

              {/* Doctor Signature Block above footer */}
              <div className="flex justify-end pt-2">
                <div className="text-right border-t border-slate-400 pt-1 min-w-[120px]">
                  <span className="font-bold text-[8.5px] text-slate-900 block">{doctorName}</span>
                  <span className="text-[6.5px] text-slate-500">Authorized Medical Practitioner</span>
                </div>
              </div>
            </div>

            {/* BOTTOM FOOTER AREA */}
            <div className="border-t border-slate-200 pt-2">
              {effectiveFooterUrl ? (
                <div className="flex flex-col items-center">
                  <div className="mb-1 flex items-center gap-1.5">
                    {hasDoctorFooter ? (
                      <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Doctor Custom Footer
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        Hospital Footer Fallback
                      </span>
                    )}
                  </div>
                  <img
                    src={getMediaUrl(effectiveFooterUrl)}
                    alt="Consultation Footer"
                    className="max-h-[45px] w-auto max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between text-[7px] text-slate-400">
                  <span>{hospitalName} • Confidential Medical Prescription</span>
                  <span>Page 1 of 1</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
