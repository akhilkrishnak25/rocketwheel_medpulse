import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Building2,
  Calendar,
  CreditCard,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  Star,
  Users,
  Clock,
  HeartPulse,
  Brain,
  Bone,
  Baby,
  Sparkles,
  Ear,
  Stethoscope,
  Activity,
  CheckCircle2,
  Flame,
  Zap,
  FlaskConical,
} from 'lucide-react';
import { hospitalsApi } from '../api/hospitals.api';
import { labApi } from '../api/lab.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { RocketWheelLogo } from '../components/common/RocketWheelLogo';

const deptIcons: Record<string, React.ReactNode> = {
  cardiology: <HeartPulse className="w-6 h-6 text-[#FF1D6B]" />,
  orthopedics: <Bone className="w-6 h-6 text-[#FBA94C]" />,
  neurology: <Brain className="w-6 h-6 text-royal-600" />,
  dermatology: <Sparkles className="w-6 h-6 text-pink-500" />,
  pediatrics: <Baby className="w-6 h-6 text-cyan-500" />,
  ent: <Ear className="w-6 h-6 text-orange-500" />,
  'general-medicine': <Stethoscope className="w-6 h-6 text-emerald-500" />,
  gynecology: <Activity className="w-6 h-6 text-purple-600" />,
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: hospitals, isLoading: hospitalsLoading } = useQuery({
    queryKey: ['hospitals', 'featured'],
    queryFn: () => hospitalsApi.list(),
  });

  const { data: approvedLabs, isLoading: labsLoading } = useQuery({
    queryKey: ['approved-labs-homepage'],
    queryFn: () => labApi.getActiveLabs(),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', 'popular'],
    queryFn: () => hospitalsApi.getDepartments(),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/hospitals?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/hospitals');
    }
  };

  return (
    <div className="space-y-16 lg:space-y-24 pb-20">
      {/* HERO SECTION IN SIGNATURE ROCKET WHEEL ROYAL BLUE */}
      <section className="relative overflow-hidden bg-[#1E20E0] text-white pt-16 pb-24 border-b border-royal-700">
        {/* Subtle decorative glowing background circles */}
        <div className="absolute top-0 right-10 w-96 h-96 bg-[#FF1D6B]/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-10 w-96 h-96 bg-[#FBA94C]/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Pill Badge with Golden Wheel Tag style */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-bold tracking-wide border border-white/20 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF1D6B] animate-pulse"></span>
              <span>Next-Gen Multi-Hospital OPD Booking</span>
              <span className="bg-[#FBA94C] text-slate-950 font-black px-2 py-0.5 rounded text-[10px] uppercase">
                Fast & Direct
              </span>
            </div>

            {/* Giant Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12]">
              Find the Right <span className="text-[#FBA94C]">Hospital</span> & Doctor
            </h1>

            <p className="text-lg sm:text-xl text-blue-100 font-normal leading-relaxed max-w-2xl mx-auto">
              Choose an accredited hospital, select your doctor, and secure an OPD appointment slot online.
              <span className="font-bold text-white block mt-1">
                Zero patient registration or login required.
              </span>
            </p>

            {/* SEARCH BAR */}
            <form
              onSubmit={handleSearchSubmit}
              className="mt-8 flex flex-col sm:flex-row gap-2.5 max-w-2xl mx-auto bg-white p-2.5 rounded-2xl shadow-2xl border-2 border-white/20"
            >
              <div className="flex-1 flex items-center gap-3 px-3 py-2">
                <Search className="w-5 h-5 text-royal-600 shrink-0" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search hospitals, doctors or departments (e.g. Apollo, Cardiology)..."
                  className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent font-medium"
                />
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto bg-[#FF1D6B] hover:bg-[#e1145a] text-white font-bold shadow-md">
                Search Network <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>

            {/* Trust Highlights */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-blue-100 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#FBA94C]" />
                Top Accredited Hospitals
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#FBA94C]" />
                Instant Official Digital OP Slip
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#FBA94C]" />
                Live OPD Queue Tracking
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* POPULAR CLINICAL DEPARTMENTS */}
      <section id="departments" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-[#FF1D6B] font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Clinical Specialities
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Popular Departments
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Select a clinical discipline to explore doctors across all partner hospitals
            </p>
          </div>
          <Link
            to="/hospitals"
            className="text-sm font-bold text-royal-600 hover:text-royal-700 flex items-center gap-1"
          >
            All Specialities <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-4 gap-3 sm:gap-4 pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          {(departments || []).map((dept) => (
            <Link
              key={dept.id}
              to={`/hospitals?department=${dept.slug}`}
              className="min-w-[150px] sm:min-w-0 snap-start p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 hover:border-royal-500 hover:shadow-md transition-all group shrink-0 sm:shrink"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-royal-50 transition-colors mb-2.5 sm:mb-3">
                {deptIcons[dept.slug] || <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-royal-600" />}
              </div>
              <h3 className="font-bold text-slate-900 group-hover:text-royal-700 text-xs sm:text-base">
                {dept.name}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 mt-0.5 sm:mt-1">
                {dept.description || 'Specialized outpatient clinical care'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* AVAILABLE HOSPITALS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-royal-600 font-bold text-xs tracking-wider uppercase mb-1">
              Partner Medical Facilities
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Available Hospitals
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Verified multi-speciality hospitals offering online OPD appointments
            </p>
          </div>
          <Link to="/hospitals">
            <Button variant="outline" size="sm" className="font-semibold">
              View All Hospitals ({hospitals?.length || 0})
            </Button>
          </Link>
        </div>

        {hospitalsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-2xl bg-slate-100 animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(hospitals || []).map((hospital) => (
              <Card key={hospital.id} hover className="flex flex-col h-full rounded-2xl border-slate-200">
                {/* Hospital Image */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  <img
                    src={hospital.imageUrl}
                    alt={hospital.name}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="absolute top-3 right-3">
                    <Badge variant="gold" className="font-black bg-[#FBA94C] text-slate-950 shadow-sm text-xs">
                      <Star className="w-3.5 h-3.5 fill-slate-950 text-slate-950 mr-1 inline" />
                      {hospital.rating}
                    </Badge>
                  </div>
                  {hospital.isEmergencyAvailable && (
                    <div className="absolute bottom-3 left-3">
                      <Badge variant="pink" className="text-[11px] font-bold">
                        24/7 Emergency
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Hospital Content */}
                <CardContent className="flex-1 flex flex-col justify-between p-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      {hospital.logoUrl && (
                        <img
                          src={hospital.logoUrl}
                          alt="logo"
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 text-base leading-snug hover:text-royal-600 transition-colors">
                          <Link to={`/hospitals/${hospital.slug}`}>{hospital.name}</Link>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {hospital.city}, {hospital.state}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {hospital.about}
                    </p>

                    {/* Departments preview tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {hospital.departments.slice(0, 3).map((dept) => (
                        <span
                          key={dept.id}
                          className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium"
                        >
                          {dept.name}
                        </span>
                      ))}
                      {hospital.departments.length > 3 && (
                        <span className="text-[11px] px-2 py-0.5 bg-royal-50 text-royal-700 rounded-md font-bold">
                          +{hospital.departments.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">OPD Specialists</div>
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-royal-600" />
                        {hospital.doctorCount} Doctors
                      </div>
                    </div>

                    <Link to={`/hospitals/${hospital.slug}`} className="inline-block text-white">
                      <Button variant="primary" size="sm" className="bg-royal-600 hover:bg-royal-700 font-bold !text-white text-white shadow-md">
                        <span className="text-white font-bold">Book Appointment</span> <ArrowRight className="w-3.5 h-3.5 ml-1 text-white" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ACCREDITED DIAGNOSTIC LABORATORIES SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">
              <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
              <span>Accredited Pathology & Diagnostic Centers</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Certified Diagnostic Laboratories
            </h2>
            <p className="text-slate-600 text-sm max-w-xl">
              Book clinical blood tests, preventive health profiles, and specialized scans directly with accredited labs.
            </p>
          </div>

          <Link to="/lab-tests">
            <Button variant="outline" className="font-bold text-xs text-purple-700 border-purple-300 hover:bg-purple-50">
              View All Diagnostic Tests & Pricing <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {labsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-56 bg-slate-100 animate-pulse rounded-2xl"></div>
            ))}
          </div>
        ) : (approvedLabs || []).length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
            No diagnostic laboratories currently active.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(approvedLabs || []).slice(0, 6).map((lab: any) => (
              <Card
                key={lab.id}
                className="rounded-2xl border-slate-200 hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between p-6 bg-white space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-3 bg-purple-50 rounded-xl text-purple-600 shrink-0">
                      <FlaskConical className="w-6 h-6" />
                    </div>
                    <Badge variant="purple" className="text-[10px]">
                      {lab.type === 'HOSPITAL_LAB' ? 'In-Hospital Lab' : 'Independent Lab'}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{lab.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lab.hospital ? `${lab.hospital.name} • ${lab.hospital.city}` : 'Accredited Independent Pathology Center'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1 font-semibold text-purple-700">
                      <Activity className="w-3.5 h-3.5 text-purple-500" />
                      {lab.testsCount || 0} Tests in Catalog
                    </span>
                    <span>•</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      License: {lab.licenseNumber || 'ACCREDITED'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <Link to={`/lab-tests?labId=${lab.id}`} className="block">
                    <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs">
                      Book Diagnostic Test <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#15179f] text-white rounded-3xl p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl mx-auto text-center space-y-3 mb-12">
            <span className="text-[#FBA94C] font-extrabold text-xs tracking-wider uppercase bg-white/10 px-3 py-1 rounded-full border border-white/10">
              5-Step Outpatient Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              How It Works
            </h2>
            <p className="text-blue-100 text-sm sm:text-base">
              Book a guaranteed hospital doctor consultation online without account registration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
            {[
              {
                step: '01',
                title: 'Select Hospital',
                desc: 'Browse accredited hospitals by city or speciality.',
                icon: <Building2 className="w-6 h-6 text-[#FBA94C]" />,
              },
              {
                step: '02',
                title: 'Select Doctor',
                desc: 'View doctor qualifications, experience, and fee.',
                icon: <Users className="w-6 h-6 text-[#FF1D6B]" />,
              },
              {
                step: '03',
                title: 'Choose Appointment',
                desc: 'Select preferred date and guaranteed live time slot.',
                icon: <Calendar className="w-6 h-6 text-[#FBA94C]" />,
              },
              {
                step: '04',
                title: 'Make Payment',
                desc: 'Pay consultation fee securely via Razorpay gateway.',
                icon: <CreditCard className="w-6 h-6 text-[#FF1D6B]" />,
              },
              {
                step: '05',
                title: 'Download Digital OP',
                desc: 'Receive official PDF OP slip with QR and queue token.',
                icon: <FileCheck2 className="w-6 h-6 text-[#FBA94C]" />,
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-[#1E20E0]/80 border border-royal-400/30 p-6 rounded-2xl flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-white/10 rounded-xl">{item.icon}</div>
                    <span className="text-2xl font-black text-white/30">{item.step}</span>
                  </div>
                  <h3 className="font-bold text-white text-base mb-1.5">{item.title}</h3>
                  <p className="text-xs text-blue-100 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link to="/hospitals" className="inline-block text-white">
              <Button size="lg" className="bg-[#FF1D6B] hover:bg-[#e1145a] !text-white text-white font-extrabold px-8 shadow-lg">
                <Calendar className="w-5 h-5 mr-2 text-white stroke-[2.5]" />
                <span className="text-white font-black">Book Appointment</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
