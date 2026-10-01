# Project Report: RocketWheel MedPulse

**RocketWheel MedPulse** is a comprehensive, multi-tenant HealthTech platform designed to centralize appointment booking and hospital administration across multiple healthcare facilities. It provides a seamless interface for patients to discover doctors and book appointments, while offering dedicated portals for clinical staff and administrators to manage hospital operations efficiently.

---

## 1. Core Modules & Features by Role

The platform implements strict Role-Based Access Control (RBAC), dividing the ecosystem into four distinct user experiences:

### 👤 Patient / Public Portal (Frontend)
* **Hospital Discovery:** Users can browse affiliated hospitals, viewing their specialties, locations, contact details, and emergency services.
* **Doctor Search & Filtering:** Patients can search for doctors globally or filter by specific hospitals and medical departments (e.g., Cardiology, Neurology).
* **Real-Time Availability:** Dynamic viewing of doctor schedules and available consultation slots.
* **Appointment Booking & Payment:** A seamless checkout flow where patients book a slot and process consultation fees (integrated with a simulated/live payment gateway).
* **Digital Receipts & QR Codes:** Upon successful booking, the system generates a downloadable PDF receipt containing a unique QR Code for hospital check-in.
* **Patient Dashboard:** Users can log in to view their upcoming and past appointments, and download their medical receipts.

### 👑 Super Administrator Portal
* **Global Analytics:** A high-level dashboard displaying total platform revenue, active hospitals, total doctors, and system-wide appointment volumes.
* **Hospital Onboarding:** Ability to register new hospitals into the MedPulse network, defining their departments, addresses, and emergency contact details.
* **Hospital Admin Management:** Super Admins create and assign the first tier of "Hospital Administrators" who will govern the newly boarded hospitals.
* **Platform Configuration:** Management of global platform fees and settings.

### 🏥 Hospital Administrator Portal
* **Hospital-Specific Dashboard:** Analytics strictly scoped to their assigned hospital (hospital revenue, daily footfall, top-performing departments).
* **Doctor Management:** Creating doctor profiles, assigning them to departments, and setting their consultation fees.
* **Schedule Configuration:** Defining working days, shift timings, and average consultation durations for their doctors.
* **Appointment Oversight:** Viewing all appointments across the hospital and managing cancellations or scheduling conflicts.

### 👨‍⚕️ Consultant Doctor Portal
* **Daily Queue:** A focused dashboard showing today's scheduled appointments and patient pipeline.
* **Patient Records:** Access to patient details and appointment history for incoming consultations.
* **Status Management:** Ability to mark appointments as "Completed" (post-consultation) or "Cancelled".

---

## 2. Complete System Workflows

### A. The Patient Booking Workflow
````mermaid
sequenceDiagram
    actor Patient
    participant Web as Frontend UI
    participant API as Core Backend
    participant DB as PostgreSQL DB

    Patient->>Web: Search Doctors by Specialty
    Web->>API: GET /api/doctors?specialty=...
    API->>DB: Query Doctors & Hospitals
    DB-->>API: Return Doctor List
    API-->>Web: Display Doctors
    
    Patient->>Web: Select Doctor & Date
    Web->>API: GET /api/appointments/slots
    API->>DB: Check existing bookings & schedule
    API-->>Web: Return Available Time Slots
    
    Patient->>Web: Pick Slot & Confirm
    Web->>API: POST /api/appointments/book
    API-->>Web: Initialize Payment (Razorpay/Demo)
    Patient->>Web: Complete Payment
    Web->>API: Verify Payment Signature
    API->>DB: Save Appointment (Status: CONFIRMED)
    API->>API: Generate PDF Receipt & QR Code
    API-->>Web: Return Success & PDF URL
    Web-->>Patient: Booking Confirmed!
````

### B. The Staff Onboarding Workflow (Top-Down)
1. **Super Admin** logs in $\rightarrow$ Creates a new **Hospital** entity.
2. **Super Admin** creates a **Hospital Admin** account, attaching it to the new Hospital.
3. **Hospital Admin** logs in $\rightarrow$ Configures hospital departments.
4. **Hospital Admin** creates **Doctor** accounts, assigning them to departments and configuring their weekly availability schedules.
5. **Doctor** can now log in, view their schedule, and appear in the public Patient search directory.

### C. Authentication & Security Workflow
* **Real-Time Auth:** Users log in using email/password. Passwords are securely hashed using `bcrypt`.
* **JWT Implementation:** The backend issues a short-lived `AccessToken` (for API requests) and a long-lived `RefreshToken` (stored securely to maintain sessions without forcing repeated logins).
* **Role Verification:** Every protected API route evaluates the JWT payload to ensure the user has the correct `ROLE` (e.g., a Doctor cannot access Hospital Admin endpoints, and a Hospital Admin cannot access data of a different hospital).

---

## 3. Technology Stack & Architecture

**Frontend Architecture (Client-Side)**
* **Framework:** React 18 with Vite for lightning-fast module bundling.
* **Styling:** Tailwind CSS for a highly responsive, modern, and accessible UI.
* **Routing:** React Router DOM for Single Page Application (SPA) navigation.
* **Form Handling:** React Hook Form integrated with Zod for robust client-side validation.
* **API Communication:** Centralized `apiClient` configured with automatic JWT injection.

**Backend Architecture (Server-Side)**
* **Runtime:** Node.js with Express.js.
* **Database:** PostgreSQL (Cloud-hosted on Render).
* **ORM:** Prisma ORM for type-safe database queries, schema migrations, and relational data management.
* **Language:** TypeScript across the entire stack for end-to-end type safety.
* **Security:** Helmet (HTTP headers), Express Rate Limiting (DDoS protection), CORS protection.
* **Utilities:** PDFKit (receipt generation), QRCode (check-in codes), Nodemailer (email notifications/OTP).

**Deployment Pipeline (Render.com)**
* **Database:** Render PostgreSQL managed database.
* **Backend:** Node Web Service with auto-build triggers (`npm ci`, Prisma schema generation, TypeScript compilation).
* **Frontend:** Static Site deployment. Requests to `/api/*` are reverse-proxied to the backend service to completely avoid cross-origin restrictions in production.

---

## 4. Current Status

The project is **fully deployed and operational**. 
* **Frontend:** Live and accessible to the public.
* **Backend:** Healthy, API routes secured, and connected to the production database.
* **Database:** Seeded with initial structural data (5 Hospitals, 18 Doctors, Admin accounts) to allow immediate operational use.
