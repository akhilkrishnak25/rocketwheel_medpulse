import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  MapPin,
  Building2,
  Star,
  Users,
  Clock,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { hospitalsApi } from '../api/hospitals.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';

export const HospitalsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const city = searchParams.get('city') || '';
  const department = searchParams.get('department') || '';
  const isEmergency = searchParams.get('emergency') === 'true';
  const sortBy = searchParams.get('sortBy') || 'rating_desc';

  const [localSearch, setLocalSearch] = useState(search);

  const { data: hospitals, isLoading } = useQuery({
    queryKey: ['hospitals', { search, city, department, isEmergency, sortBy }],
    queryFn: () =>
      hospitalsApi.list({
        search,
        city: city || undefined,
        department: department || undefined,
        isEmergencyAvailable: isEmergency ? true : undefined,
        sortBy,
      }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', 'all'],
    queryFn: () => hospitalsApi.getDepartments(),
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('search', localSearch.trim() || null);
  };

  const clearFilters = () => {
    setLocalSearch('');
    setSearchParams(new URLSearchParams());
  };

  // Dynamically extract unique cities from network hospitals
  const availableCities = Array.from(
    new Set((hospitals || []).map((h) => h.city).filter(Boolean))
  );
  const displayCities = availableCities.length > 0 ? availableCities : ['Hyderabad', 'Bengaluru', 'New Delhi'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <div className="text-royal-600 font-extrabold text-xs uppercase tracking-wider mb-1">
          Rocket Wheel Network
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Accredited Hospital Directory
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Explore partner tertiary hospitals, multi-speciality institutions, and medical institutes
        </p>
      </div>

      {/* FILTERS TOOLBAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Search row */}
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <Search className="w-4 h-4 text-royal-600 shrink-0" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by hospital name, area, or clinical service..."
              className="w-full text-sm bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
            />
          </div>
          <Button type="submit" size="md" className="bg-royal-600 hover:bg-royal-700 font-bold">
            Search
          </Button>
          {(search || city || department || isEmergency) && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={clearFilters}
              className="text-slate-500"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
            </Button>
          )}
        </form>

        {/* Mobile Quick-Tap Filter Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5 -mx-1 px-1">
          <button
            type="button"
            onClick={() => updateParam('city', null)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              !city ? 'bg-royal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Cities
          </button>
          {displayCities.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateParam('city', city === c ? null : c)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                city === c ? 'bg-royal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            onClick={() => updateParam('emergency', isEmergency ? null : 'true')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              isEmergency ? 'bg-[#FF1D6B] text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> 24/7 Emergency
          </button>
        </div>

        {/* Dropdowns / Detailed Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs border-t border-slate-100">
          {/* City filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">City:</span>
            <select
              value={city}
              onChange={(e) => updateParam('city', e.target.value || null)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:ring-royal-500"
            >
              <option value="">All Cities</option>
              {displayCities.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Department filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Speciality:</span>
            <select
              value={department}
              onChange={(e) => updateParam('department', e.target.value || null)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:ring-royal-500"
            >
              <option value="">All Specialities</option>
              {(departments || []).map((d) => (
                <option key={d.id} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => updateParam('sortBy', e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:ring-royal-500"
            >
              <option value="rating_desc">Highest Rated</option>
              <option value="name_asc">Hospital Name (A-Z)</option>
            </select>
          </div>

          {/* Emergency 24/7 filter */}
          <label className="flex items-center gap-2 cursor-pointer ml-auto bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={isEmergency}
              onChange={(e) => updateParam('emergency', e.target.checked ? 'true' : null)}
              className="w-3.5 h-3.5 text-royal-600 rounded border-slate-300 focus:ring-royal-500"
            />
            <span className="font-bold text-slate-700">24/7 Emergency Available</span>
          </label>
        </div>
      </div>

      {/* RESULTS LIST */}
      <div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-96 rounded-2xl bg-slate-100 animate-pulse"></div>
            ))}
          </div>
        ) : !hospitals || hospitals.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 p-8">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900">No Hospitals Found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              We couldn't find any hospitals matching your current search and filter criteria.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
              Clear All Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hospitals.map((hospital) => (
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

                {/* Hospital Details */}
                <CardContent className="flex-1 flex flex-col justify-between p-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      {hospital.logoUrl && (
                        <img
                          src={hospital.logoUrl}
                          alt="logo"
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 text-base leading-snug hover:text-royal-600 transition-colors">
                          <Link to={`/hospitals/${hospital.slug}`}>{hospital.name}</Link>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {hospital.city}, {hospital.state}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {hospital.about}
                    </p>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{hospital.openingHours}</span>
                    </div>

                    {/* Department preview */}
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
                      <div className="text-[11px] text-slate-500 font-medium">Doctors</div>
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
      </div>
    </div>
  );
};
