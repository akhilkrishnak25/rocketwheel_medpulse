import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { DoctorLayout } from './layouts/DoctorLayout';
import { SuperAdminLayout } from './layouts/SuperAdminLayout';

import { HomePage } from './pages/HomePage';
import { HospitalsPage } from './pages/HospitalsPage';
import { HospitalDetailPage } from './pages/HospitalDetailPage';
import { DoctorProfilePage } from './pages/DoctorProfilePage';
import { BookingPage } from './pages/BookingPage';
import { AppointmentConfirmationPage } from './pages/AppointmentConfirmationPage';
import { OpVerificationPage } from './pages/OpVerificationPage';
import { AppointmentLookupPage } from './pages/AppointmentLookupPage';
import { StaffLoginPage } from './pages/StaffLoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ActivateAccountPage } from './pages/ActivateAccountPage';
import { HospitalRegistrationPage } from './pages/HospitalRegistrationPage';

import { HospitalAdminDashboardPage } from './pages/HospitalAdminDashboardPage';
import { DoctorDashboardPage } from './pages/DoctorDashboardPage';
import { SuperAdminDashboardPage } from './pages/SuperAdminDashboardPage';
import { Button } from './components/ui/Button';

// 404 Not Found Component
const NotFoundPage = () => (
  <div className="max-w-md mx-auto py-24 text-center px-4 space-y-4">
    <div className="text-6xl font-black text-royal-600">404</div>
    <h2 className="text-2xl font-bold text-slate-900">Page Not Found</h2>
    <p className="text-xs text-slate-500">
      The medical appointment page or clinical resource you were searching for does not exist.
    </p>
    <Link to="/" className="inline-block mt-4">
      <Button variant="primary">Return to Homepage</Button>
    </Link>
  </div>
);

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Patient & Staff Journey (NO LOGIN REQUIRED FOR PATIENT BOOKING) */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/hospitals" element={<HospitalsPage />} />
        <Route path="/hospitals/:hospitalId" element={<HospitalDetailPage />} />
        <Route path="/doctors/:doctorId" element={<DoctorProfilePage />} />
        <Route path="/book/:doctorId" element={<BookingPage />} />
        <Route
          path="/appointments/:appointmentId/confirmed"
          element={<AppointmentConfirmationPage />}
        />
        <Route path="/verify-op/:token" element={<OpVerificationPage />} />
        <Route path="/check-appointment" element={<AppointmentLookupPage />} />
        
        {/* Real-time Authentication & Onboarding Routes */}
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/staff/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/staff/reset-password" element={<ResetPasswordPage />} />
        <Route path="/staff/activate" element={<ActivateAccountPage />} />
        <Route path="/activate" element={<ActivateAccountPage />} />
        <Route path="/register-hospital" element={<HospitalRegistrationPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Hospital Admin Portal */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<HospitalAdminDashboardPage />} />
      </Route>

      {/* Doctor OPD Portal */}
      <Route path="/doctor" element={<DoctorLayout />}>
        <Route index element={<DoctorDashboardPage />} />
      </Route>

      {/* Super Admin Platform Oversight */}
      <Route path="/super-admin" element={<SuperAdminLayout />}>
        <Route index element={<SuperAdminDashboardPage />} />
      </Route>
    </Routes>
  );
};

export default App;
