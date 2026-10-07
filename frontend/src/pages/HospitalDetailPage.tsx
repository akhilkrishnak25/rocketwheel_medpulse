import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldAlert,
  Star,
  Building,
  CheckCircle,
  Search,
  Filter,
  ArrowRight,
  Stethoscope,
  Calendar,
} from 'lucide-react';
import { hospitalsApi } from '../api/hospitals.api';
import { getMediaUrl } from '../api/client';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';

export const HospitalDetailPage: React.FC = () => {
  const { hospitalId } = useParams<{ hospitalId: string }>();

  const [selectedDept, setSelectedDept] = useState<string>('');
  const [specializationSearch, setSpecializationSearch] = useState<string>('');
  const [maxFee, setMaxFee] = useState<number | ''>('');

  const { data: hospital, isLoading: hospitalLoading } = useQuery({
    queryKey: ['hospital', hospitalId],
    queryFn: () => hospitalsApi.getById(hospitalId!),
    enabled: !!hospitalId,
  });

  const { data: doctors, isLoading: doctorsLoading } = useQuery({
    queryKey: [
      'hospital-doctors',
      hospital?.id,
      selectedDept,
      specializationSearch,
      maxFee,
    ],
    queryFn: () =>
      hospitalsApi.getDoctors(hospital!.id, {
        department: selectedDept || undefined,
        specialization: specializationSearch || undefined,
        maxFee: maxFee ? Number(maxFee) : undefined,
      }),
    enabled: !!hospital?.id,
  });

  if (hospitalLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="h-72 bg-slate-100 rounded-3xl animate-pulse mb-8"></div>
        <div className="space-y-4">
          <div className="h-8 bg-slate-100 w-1/3 rounded-lg animate-pulse"></div>
          <div className="h-4 bg-slate-100 w-2/3 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">Hospital Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">
          The requested hospital facility could not be found or is temporarily unavailable.
        </p>
        <Link to="/hospitals" className="mt-6 inline-block">
          <Button variant="primary">Return to Hospitals</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {/* HOSPITAL HERO BANNER IN ROCKET WHEEL ROYAL BLUE */}
      <div className="relative bg-[#1E20E0] text-white overflow-hidden shadow-lg border-b border-royal-700">
        <div className="absolute inset-0 opacity-20">
          <img
            src={getMediaUrl(hospital.imageUrl) || 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&auto=format&fit=crop&q=80'}
            alt={hospital.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&auto=format&fit=crop&q=80';
            }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center gap-3">
                {hospital.logoUrl && (
                  <img
                    src={getMediaUrl(hospital.logoUrl)}
                    alt="logo"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 shadow-md shrink-0 bg-white"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-[#FBA94C]">
                      Code: {hospital.code}
                    </span>
                    <span className="text-white/40">•</span>
                    <Badge variant="gold" className="text-xs font-black bg-[#FBA94C] text-slate-950">
                      <Star className="w-3.5 h-3.5 fill-slate-950 mr-1 inline" />
                      {hospital.rating} Rating
                    </Badge>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    {hospital.name}
                  </h1>
                </div>
              </div>

              <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
                {hospital.about}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-blue-100 pt-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#FBA94C] shrink-0" />
                  <span>{hospital.address}, {hospital.city}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FBA94C] shrink-0" />
                  <span>{hospital.openingHours}</span>
                </div>
                <div className="flex items-center gap-2 text-rose-200 font-bold">
                  <ShieldAlert className="w-4 h-4 text-[#FF1D6B] shrink-0" />
                  <span>Emergency: {hospital.emergencyContact}</span>
                </div>
              </div>
            </div>

            {/* Direct Contact Box */}
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 space-y-3 shrink-0">
              <div className="text-xs font-bold uppercase text-[#FBA94C] tracking-wider">
                Direct Contact
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#FBA94C]" />
                {hospital.phone}
              </div>
              <div className="text-sm text-blue-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#FBA94C]" />
                {hospital.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* FACILITIES SECTION */}
        <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-royal-600" />
            Accredited Facilities & Amenities
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {(hospital.facilities || []).map((fac, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-royal-50/60 text-royal-900 text-xs font-semibold border border-royal-200"
              >
                <CheckCircle className="w-3.5 h-3.5 text-[#FF1D6B]" />
                {fac}
              </span>
            ))}
          </div>
        </section>

        {/* CLINICAL DEPARTMENTS AT THIS HOSPITAL */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Speciality Departments
              </h2>
              <p className="text-xs text-slate-500">
                Click a department to filter doctors available for consultation
              </p>
            </div>
            {selectedDept && (
              <button
                onClick={() => setSelectedDept('')}
                className="text-xs text-[#FF1D6B] font-bold hover:underline"
              >
                Show All Departments
              </button>
            )}
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedDept('')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                !selectedDept
                  ? 'bg-royal-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Departments ({hospital.departments?.length || 0})
            </button>
            {(hospital.departments || []).map((dept) => (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept.slug === selectedDept ? '' : dept.slug)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedDept === dept.slug
                    ? 'bg-royal-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {dept.name}
              </button>
            ))}
          </div>
        </section>

        {/* DOCTORS AT THIS HOSPITAL */}
        <section id="doctors" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-royal-600 font-bold text-xs uppercase tracking-wider">
                Exclusively at {hospital.name}
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Doctors at this Hospital
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {doctors?.length || 0} accredited specialists available for booking
              </p>
            </div>

            {/* Doctor filters */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-royal-600" />
                <input
                  type="text"
                  value={specializationSearch}
                  onChange={(e) => setSpecializationSearch(e.target.value)}
                  placeholder="Filter by specialization..."
                  className="w-36 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none font-medium"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-slate-500 font-semibold">Max Fee:</span>
                <select
                  value={maxFee}
                  onChange={(e) => setMaxFee(e.target.value ? Number(e.target.value) : '')}
                  className="bg-transparent text-slate-800 text-xs font-semibold focus:outline-none"
                >
                  <option value="">Any Fee</option>
                  <option value="500">Up to ₹500</option>
                  <option value="800">Up to ₹800</option>
                  <option value="1000">Up to ₹1000</option>
                </select>
              </div>
            </div>
          </div>

          {doctorsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-56 bg-slate-100 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : !doctors || doctors.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
              <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No Doctors Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No doctors matching your department or specialization filters are currently registered for this hospital.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedDept('');
                  setSpecializationSearch('');
                  setMaxFee('');
                }}
                className="mt-4"
              >
                Clear Doctor Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {doctors.map((doctor) => (
                <Card key={doctor.id} hover className="flex flex-col justify-between rounded-2xl p-6 border-slate-200">
                  <div className="flex items-start gap-4">
                    <img
                      src={getMediaUrl(doctor.photoUrl) || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80'}
                      alt={doctor.name}
                      className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80';
                      }}
                    />

                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg hover:text-royal-600 transition-colors">
                            <Link to={`/doctors/${doctor.id}`}>{doctor.name}</Link>
                          </h3>
                          <div className="text-xs font-bold text-royal-600">
                            {doctor.specialization}
                          </div>
                        </div>

                        <Badge variant="pink" className="text-[11px] font-bold">
                          {doctor.department?.name}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-500 font-medium pt-0.5">
                        {doctor.qualification}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                        <span>{doctor.experienceYears}+ Yrs Exp</span>
                        <span>•</span>
                        <span>{doctor.languages}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 my-4 leading-relaxed">
                    {doctor.about}
                  </p>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                        Consultation Fee
                      </div>
                      <div className="text-base font-black text-slate-900">
                        ₹{doctor.consultationFee}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link to={`/doctors/${doctor.id}`}>
                        <Button variant="outline" size="sm">
                          Profile
                        </Button>
                      </Link>
                      <Link to={`/book/${doctor.id}`} className="inline-block text-white">
                        <Button variant="primary" size="sm" className="bg-royal-600 hover:bg-royal-700 shadow-md font-bold !text-white text-white">
                          <Calendar className="w-3.5 h-3.5 mr-1.5 text-white stroke-[2.5]" />
                          <span className="text-white font-bold">Book Appointment</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
