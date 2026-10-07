import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Award,
  Globe,
  Star,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { doctorsApi } from '../api/doctors.api';
import { getMediaUrl } from '../api/client';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

export const DoctorProfilePage: React.FC = () => {
  const { doctorId } = useParams<{ doctorId: string }>();

  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: () => doctorsApi.getById(doctorId!),
    enabled: !!doctorId,
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse mb-8"></div>
        <div className="space-y-4">
          <div className="h-8 bg-slate-100 w-1/3 rounded-lg animate-pulse"></div>
          <div className="h-24 bg-slate-100 rounded-2xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <h2 className="text-2xl font-bold text-slate-900">Doctor Profile Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">
          The requested doctor profile could not be located in our system.
        </p>
        <Link to="/hospitals" className="mt-6 inline-block">
          <Button variant="primary">Browse Hospitals & Doctors</Button>
        </Link>
      </div>
    );
  }

  const workingDaysList = doctor.workingDays.split(',').map((d) => d.trim());

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* DOCTOR HERO CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-start">
        <img
          src={getMediaUrl(doctor.photoUrl) || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80'}
          alt={doctor.name}
          className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl object-cover border-2 border-slate-100 shadow-md shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80';
          }}
        />

        <div className="flex-1 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge variant="purple" className="font-semibold text-xs">
                {doctor.department?.name}
              </Badge>
              <Badge variant="success" className="font-semibold text-xs">
                <Star className="w-3.5 h-3.5 fill-current mr-1 inline" />
                {doctor.averageRating || 4.8} ({doctor.reviewCount || 1} Reviews)
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {doctor.name}
            </h1>
            <p className="text-sm font-semibold text-royal-600 mt-0.5">
              {doctor.specialization}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {doctor.qualification}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-royal-600" />
              <strong>{doctor.experienceYears}+ Years</strong> Clinical Practice
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-royal-600" />
              {doctor.languages}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Consultation Fee
              </div>
              <div className="text-2xl font-black text-slate-900">
                ₹{doctor.consultationFee}
              </div>
            </div>

            <Link to={`/book/${doctor.id}`} className="inline-block text-white">
              <Button size="lg" className="w-full sm:w-auto shadow-lg bg-royal-600 hover:bg-royal-700 !text-white text-white font-extrabold px-7 py-3">
                <Calendar className="w-5 h-5 mr-2 text-white stroke-[2.5]" />
                <span className="text-white font-black tracking-wide text-sm sm:text-base">Book Appointment</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT 2 COLS: ABOUT, SCHEDULE & REVIEWS */}
        <div className="md:col-span-2 space-y-8">
          {/* About Doctor */}
          <Card className="rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-slate-900">About Doctor</h2>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {doctor.about}
            </p>
          </Card>

          {/* Working Schedule */}
          <Card className="rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-royal-600" />
              Consultation Schedule & OPD Hours
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-600 font-medium">Consulting Hours:</span>
                <span className="font-bold text-slate-900">
                  {doctor.workingHoursStart} - {doctor.workingHoursEnd} (30 Min Slots)
                </span>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">
                  Weekly Consultation Days:
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                    const isWorking = workingDaysList.includes(day);
                    return (
                      <span
                        key={day}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                          isWorking
                            ? 'bg-royal-50 text-royal-700 border border-royal-200'
                            : 'bg-slate-100 text-slate-400 opacity-60'
                        }`}
                      >
                        {day}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Patient Reviews */}
          <Card className="rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-pink-500" />
              Verified Patient Reviews
            </h2>

            {doctor.reviews && doctor.reviews.length > 0 ? (
              <div className="space-y-4">
                {doctor.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{rev.patientName}</span>
                      <div className="flex text-amber-400">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No patient reviews yet for this doctor.</p>
            )}
          </Card>
        </div>

        {/* RIGHT COL: HOSPITAL INFORMATION & STICKY BOOKING */}
        <div className="space-y-6">
          <Card className="rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-royal-600" />
              Hospital Location
            </h2>

            {doctor.hospital && (
              <div className="space-y-3 text-xs text-slate-600">
                <Link
                  to={`/hospitals/${doctor.hospital.slug}`}
                  className="font-bold text-sm text-slate-900 hover:text-royal-600 block transition-colors"
                >
                  {doctor.hospital.name}
                </Link>

                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {doctor.hospital.address}, {doctor.hospital.city}
                  </span>
                </p>

                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{doctor.hospital.openingHours}</span>
                </p>

                <p className="flex items-center gap-2 text-rose-600 font-semibold">
                  <span>Emergency: {doctor.hospital.emergencyContact}</span>
                </p>

                <Link
                  to={`/hospitals/${doctor.hospital.slug}`}
                  className="text-royal-600 font-semibold block pt-2 hover:underline"
                >
                  View Hospital Details & Other Doctors →
                </Link>
              </div>
            )}
          </Card>

          <Card className="rounded-2xl p-6 bg-gradient-to-br from-royal-50 via-white to-pink-50/20 border-royal-200/60 space-y-4">
            <div className="flex items-center gap-2 text-royal-900 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-royal-600" />
              Guaranteed Outpatient Slot
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Booking online reserves your time slot directly in the hospital OPD queue with an official downloadable Digital OP slip.
            </p>
            <Link to={`/book/${doctor.id}`} className="block text-white">
              <Button size="md" className="w-full bg-royal-600 hover:bg-royal-700 !text-white text-white font-extrabold py-3 shadow-md">
                <Calendar className="w-4 h-4 mr-2 text-white stroke-[2.5]" />
                <span className="text-white font-bold text-sm">Book Appointment</span>
              </Button>
            </Link>
          </Card>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM ACTION BAR */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] safe-area-bottom">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Consultation Fee</div>
            <div className="text-xl font-black text-slate-900 leading-tight">₹{doctor.consultationFee}</div>
            <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Slots Available
            </div>
          </div>
          <Link to={`/book/${doctor.id}`} className="flex-1 max-w-[210px]">
            <Button size="md" className="w-full bg-royal-600 hover:bg-royal-700 !text-white text-white font-extrabold py-2.5 shadow-md">
              <Calendar className="w-4 h-4 mr-1.5 text-white stroke-[2.5]" />
              <span className="text-white font-bold text-sm">Book Appointment</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
