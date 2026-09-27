import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data in reverse order of foreign key dependencies
  await prisma.auditLog.deleteMany();
  await prisma.accountToken.deleteMany();
  await prisma.review.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.digitalOP.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.appointmentSlot.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.otpVerification.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.doctorLeave.deleteMany();
  await prisma.doctorSchedule.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.department.deleteMany();
  await prisma.hospitalAdmin.deleteMany();
  await prisma.hospital.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  // 1. Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@medipulse.org',
      passwordHash: defaultPasswordHash,
      role: 'SUPER_ADMIN',
      name: 'Dr. Amitabh Verma',
      phone: '+91 98765 43210',
    },
  });

  // 2. Hospitals Data
  const hospitalsData = [
    {
      name: 'Apollo Hospitals, Jubilee Hills',
      slug: 'apollo-hospitals-jubilee-hills',
      code: 'APOL-HYD',
      logoUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=150&auto=format&fit=crop&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&auto=format&fit=crop&q=80',
      address: 'Road No. 72, Opposite Bharatiya Vidya Bhavan, Film Nagar, Jubilee Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500033',
      phone: '+91 40 2360 7777',
      email: 'contact@apollohyd.medipulse.org',
      emergencyContact: '+91 40 1066',
      openingHours: '24/7 (Emergency & IPD), OPD: 08:30 AM - 08:00 PM',
      about: 'Apollo Hospitals Jubilee Hills is a flagship tertiary care facility renowned internationally for cardiology, neurology, robotic surgery, and emergency care.',
      facilities: JSON.stringify(['24/7 Emergency Care', 'Robotic Surgery Suite', 'JCI Accredited', 'Level 3 NICU', 'PET-CT & 3T MRI', 'In-house Pharmacy', 'Valet Parking']),
      rating: 4.8,
      isEmergencyAvailable: true,
      adminEmail: 'admin.apollo@medipulse.org',
      adminName: 'Suresh Nambiar',
    },
    {
      name: 'Fortis Hospital, Bannerghatta Road',
      slug: 'fortis-hospital-bannerghatta',
      code: 'FORT-BLR',
      logoUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=150&auto=format&fit=crop&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&auto=format&fit=crop&q=80',
      address: '154/9, Bannerghatta Main Rd, Opposite IIM-B, Bilekahalli',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560076',
      phone: '+91 80 6621 4444',
      email: 'care@fortisblr.medipulse.org',
      emergencyContact: '+91 80 1050',
      openingHours: '24/7 (Emergency), OPD: 09:00 AM - 07:00 PM',
      about: 'Fortis Hospital Bannerghatta Road has been recognized as one of the best multi-speciality hospitals in Karnataka with premier orthopedic and cancer care institutes.',
      facilities: JSON.stringify(['24/7 Trauma Care', 'NABH & JCI Certified', 'Advanced Cath Lab', 'Bone Marrow Transplant', 'Dialysis Unit', 'Cafeteria']),
      rating: 4.7,
      isEmergencyAvailable: true,
      adminEmail: 'admin.fortis@medipulse.org',
      adminName: 'Rashmi Deshmukh',
    },
    {
      name: 'Max Super Speciality Hospital, Saket',
      slug: 'max-hospital-saket',
      code: 'MAX-DEL',
      logoUrl: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=150&auto=format&fit=crop&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1200&auto=format&fit=crop&q=80',
      address: '1, 2, Press Enclave Marg, Saket Institutional Area, Saket',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110017',
      phone: '+91 11 2651 5050',
      email: 'info@maxsaket.medipulse.org',
      emergencyContact: '+91 11 4055 4055',
      openingHours: '24/7 (Emergency), OPD: 08:00 AM - 08:00 PM',
      about: 'Max Super Speciality Hospital Saket is an established center of excellence for cardiovascular sciences, neurosciences, organ transplants, and minimally invasive surgery.',
      facilities: JSON.stringify(['Da Vinci Xi Robotic Surgery', 'Asia-Pacific Stroke Center', 'Bone Marrow Transplant Unit', 'Day Care Surgeries', 'Ambulance GPS Tracking']),
      rating: 4.9,
      isEmergencyAvailable: true,
      adminEmail: 'admin.max@medipulse.org',
      adminName: 'Rajeev Singhania',
    },
    {
      name: 'Manipal Hospital, Whitefield',
      slug: 'manipal-hospital-whitefield',
      code: 'MANI-BLR',
      logoUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=150&auto=format&fit=crop&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=1200&auto=format&fit=crop&q=80',
      address: '#143, 212-215, EPIP Zone, Off Hoodi Village, KR Puram Hobli, Whitefield',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560066',
      phone: '+91 80 2502 4444',
      email: 'help@manipalblr.medipulse.org',
      emergencyContact: '+91 80 2222 1111',
      openingHours: '24/7 (Emergency), OPD: 08:30 AM - 07:30 PM',
      about: 'Manipal Hospital Whitefield offers quaternary healthcare services with state-of-the-art diagnostic and clinical infrastructure for IT corridor residents.',
      facilities: JSON.stringify(['Advanced Cardiac Life Support', 'Chemotherapy Suite', 'Pediatric ICU', 'Comprehensive Health Checkups', 'Blood Bank']),
      rating: 4.6,
      isEmergencyAvailable: true,
      adminEmail: 'admin.manipal@medipulse.org',
      adminName: 'Geetha Narayanan',
    },
    {
      name: 'AIIMS - All India Institute of Medical Sciences',
      slug: 'aiims-new-delhi',
      code: 'AIIMS-DEL',
      logoUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=150&auto=format&fit=crop&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1200&auto=format&fit=crop&q=80',
      address: 'Sri Aurobindo Marg, Ansari Nagar, Ansari Nagar East',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110029',
      phone: '+91 11 2658 8500',
      email: 'director@aiims.medipulse.org',
      emergencyContact: '+91 11 2659 4405',
      openingHours: '24/7 (Emergency & Trauma), OPD: 08:00 AM - 04:00 PM',
      about: 'AIIMS New Delhi is the apex public healthcare and medical research institution of India, known for unmatched clinical expertise and affordable care.',
      facilities: JSON.stringify(['National Apex Trauma Center', 'Specialized Research Labs', 'National Cancer Institute', 'Subsidized Medicine Store', 'Helipad']),
      rating: 4.9,
      isEmergencyAvailable: true,
      adminEmail: 'admin.aiims@medipulse.org',
      adminName: 'Prof. K. K. Talwar',
    },
  ];

  // Common Department Templates
  const departmentTemplates = [
    { name: 'Cardiology', slug: 'cardiology', code: 'CARD', description: 'Comprehensive heart care, interventional cardiology, electrophysiology, and bypass rehabilitation.', icon: 'HeartPulse' },
    { name: 'Orthopedics', slug: 'orthopedics', code: 'ORTHO', description: 'Joint replacement, spine surgeries, sports medicine, arthroscopy, and complex trauma.', icon: 'Bone' },
    { name: 'Neurology', slug: 'neurology', code: 'NEURO', description: 'Advanced stroke management, epilepsy clinics, neuro-rehab, and brain disorder care.', icon: 'Brain' },
    { name: 'Dermatology', slug: 'dermatology', code: 'DERM', description: 'Clinical skin therapies, pediatric dermatology, allergy testing, and cosmetic lasers.', icon: 'Sparkles' },
    { name: 'Pediatrics', slug: 'pediatrics', code: 'PED', description: 'Neonatal intensive care, growth milestones, vaccinations, and pediatric acute care.', icon: 'Baby' },
    { name: 'ENT', slug: 'ent', code: 'ENT', description: 'Micro-ear surgery, endoscopic sinus care, speech therapy, and snoring clinics.', icon: 'Ear' },
    { name: 'General Medicine', slug: 'general-medicine', code: 'GENMED', description: 'Preventive checkups, diabetes control, infectious diseases, and chronic illness management.', icon: 'Stethoscope' },
    { name: 'Gynecology', slug: 'gynecology', code: 'GYN', description: 'High-risk obstetrics, painless deliveries, fertility screening, and laparoscopic women surgery.', icon: 'Activity' },
  ];

  const createdHospitals: any[] = [];
  const hospitalAdminUsers: any[] = [];

  for (const hData of hospitalsData) {
    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: hData.adminEmail,
        passwordHash: defaultPasswordHash,
        role: 'HOSPITAL_ADMIN',
        name: hData.adminName,
        phone: '+91 91234 56789',
      },
    });
    hospitalAdminUsers.push(adminUser);

    // Create hospital
    const hospital = await prisma.hospital.create({
      data: {
        name: hData.name,
        slug: hData.slug,
        code: hData.code,
        logoUrl: hData.logoUrl,
        imageUrl: hData.imageUrl,
        address: hData.address,
        city: hData.city,
        state: hData.state,
        pincode: hData.pincode,
        phone: hData.phone,
        email: hData.email,
        emergencyContact: hData.emergencyContact,
        openingHours: hData.openingHours,
        about: hData.about,
        facilities: hData.facilities,
        rating: hData.rating,
        isEmergencyAvailable: hData.isEmergencyAvailable,
      },
    });
    createdHospitals.push(hospital);

    // Link HospitalAdmin relation
    await prisma.hospitalAdmin.create({
      data: {
        userId: adminUser.id,
        hospitalId: hospital.id,
        roleTitle: 'Chief Medical Administrator',
      },
    });

    // Create departments for this hospital
    for (const dt of departmentTemplates) {
      await prisma.department.create({
        data: {
          hospitalId: hospital.id,
          name: dt.name,
          slug: dt.slug,
          code: `${hospital.code.split('-')[0]}-${dt.code}`,
          description: dt.description,
          icon: dt.icon,
        },
      });
    }
  }

  console.log(`✅ Created ${createdHospitals.length} Hospitals & Departments`);

  // 2b. Pending Hospital Registration (for Super Admin approval testing)
  const pendingAdmin = await prisma.user.create({
    data: {
      email: 'admin.metro@medipulse.org',
      passwordHash: defaultPasswordHash,
      role: 'HOSPITAL_ADMIN',
      name: 'Dr. Anand Iyer',
      phone: '+91 94444 11223',
      status: 'PENDING',
      isActive: false,
    },
  });

  const pendingHospital = await prisma.hospital.create({
    data: {
      name: 'Metropolitan Multispeciality Hospital',
      slug: 'metropolitan-multispeciality-hospital',
      code: 'METRO-CHE',
      status: 'PENDING',
      website: 'https://metrochennai.org',
      logoUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=150&auto=format&fit=crop&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&auto=format&fit=crop&q=80',
      address: '24 GST Road, Guindy',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600032',
      phone: '+91 44 2235 9999',
      email: 'admin.metro@medipulse.org',
      emergencyContact: '+91 44 1055',
      openingHours: '24/7 (Emergency), OPD: 08:30 AM - 08:00 PM',
      about: 'Metropolitan Multispeciality Hospital is an advanced tertiary healthcare center applying for MediPulse platform accreditation.',
      facilities: JSON.stringify(['24/7 Trauma Care', 'Dialysis Center', 'Cath Lab', 'CT & MRI Imaging']),
      rating: 4.6,
      isEmergencyAvailable: true,
    },
  });

  await prisma.hospitalAdmin.create({
    data: {
      userId: pendingAdmin.id,
      hospitalId: pendingHospital.id,
      roleTitle: 'Chief Medical Administrator',
    },
  });

  // 3. Doctors Dataset (17 Doctors across hospitals and departments)
  const doctorsData = [
    // Apollo Jubilee Hills (Pending Doctor for Admin Approval Testing)
    {
      hospitalCode: 'APOL-HYD',
      deptSlug: 'cardiology',
      name: 'Dr. Ananya Ray',
      email: 'dr.ananya@apollo.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD (Pediatrics), DM (Pediatric Cardiology)',
      specialization: 'Consultant Pediatric Cardiologist',
      experienceYears: 7,
      consultationFee: 700,
      languages: 'English, Hindi, Bengali',
      about: 'Pediatric cardiologist specializing in congenital heart disease, fetal echocardiography, and pediatric catheter interventions.',
      workingDays: 'Mon,Tue,Wed,Thu,Fri',
      workingHoursStart: '10:00',
      workingHoursEnd: '16:00',
      status: 'PENDING',
    },
    // Apollo Jubilee Hills
    {
      hospitalCode: 'APOL-HYD',
      deptSlug: 'cardiology',
      name: 'Dr. Rahul Kumar',
      email: 'dr.rahul@apollo.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD (General Medicine), DM (Cardiology), FACC',
      specialization: 'Senior Interventional Cardiologist',
      experienceYears: 18,
      consultationFee: 850,
      languages: 'English, Hindi, Telugu',
      about: 'Dr. Rahul Kumar has completed over 6,500 complex coronary angioplasties and pacemaker implantations with over 18 years of clinical leadership.',
      workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
      workingHoursStart: '09:00',
      workingHoursEnd: '14:00',
    },
    {
      hospitalCode: 'APOL-HYD',
      deptSlug: 'neurology',
      name: 'Dr. Priya Sharma',
      email: 'dr.priya@apollo.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1594824813571-638ef061a998?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD, DM (Neurology), Fellow Stroke Medicine',
      specialization: 'Consultant Neurologist & Stroke Specialist',
      experienceYears: 12,
      consultationFee: 750,
      languages: 'English, Hindi, Telugu',
      about: 'Specializes in acute ischemic stroke intervention, migraine management, epilepsy monitoring, and Parkinson’s deep brain stimulation programming.',
      workingDays: 'Mon,Wed,Fri,Sat',
      workingHoursStart: '10:00',
      workingHoursEnd: '16:00',
    },
    {
      hospitalCode: 'APOL-HYD',
      deptSlug: 'orthopedics',
      name: 'Dr. Arvind Swamy',
      email: 'dr.arvind@apollo.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MS (Ortho), MCh Orth (UK), Fellow Adult Joint Reconstruction',
      specialization: 'Senior Robotic Joint Replacement Surgeon',
      experienceYears: 15,
      consultationFee: 800,
      languages: 'English, Hindi, Telugu, Tamil',
      about: 'Pioneer in robotic assisted knee and hip replacements, computer navigation surgery, and complex revision arthroplasty.',
      workingDays: 'Tue,Thu,Fri,Sat',
      workingHoursStart: '09:30',
      workingHoursEnd: '15:30',
    },
    {
      hospitalCode: 'APOL-HYD',
      deptSlug: 'ent',
      name: 'Dr. Farooq Ahmed',
      email: 'dr.farooq@apollo.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MS (ENT), DNB (Otolaryngology)',
      specialization: 'Senior ENT, Head & Neck Surgeon',
      experienceYears: 11,
      consultationFee: 650,
      languages: 'English, Urdu, Hindi, Telugu',
      about: 'Specialist in microscopic ear surgery, coblation tonsillectomy, and endoscopic sinus operations for nasal polyps.',
      workingDays: 'Mon,Tue,Wed,Thu,Sat',
      workingHoursStart: '11:00',
      workingHoursEnd: '18:00',
    },

    // Fortis Hospital Bengaluru
    {
      hospitalCode: 'FORT-BLR',
      deptSlug: 'dermatology',
      name: 'Dr. Ananya Sen',
      email: 'dr.ananya@fortis.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD (Dermatology, Venereology & Leprosy)',
      specialization: 'Consultant Dermatologist & Dermatosurgeon',
      experienceYears: 9,
      consultationFee: 700,
      languages: 'English, Hindi, Kannada, Bengali',
      about: 'Expert in clinical dermatology, stubborn psoriasis, eczema therapies, acne scar revisions, and medical hair restoration.',
      workingDays: 'Mon,Tue,Wed,Thu,Fri',
      workingHoursStart: '10:00',
      workingHoursEnd: '17:00',
    },
    {
      hospitalCode: 'FORT-BLR',
      deptSlug: 'general-medicine',
      name: 'Dr. Rajesh Mehta',
      email: 'dr.rajesh@fortis.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD (Internal Medicine), PG Diabetology (Boston)',
      specialization: 'Senior Consultant Physician & Diabetologist',
      experienceYears: 20,
      consultationFee: 600,
      languages: 'English, Hindi, Gujarati, Kannada',
      about: 'Focuses on multi-system disorders, adult lifestyle diseases, diabetic foot salvage, and geriatric medicine.',
      workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
      workingHoursStart: '08:30',
      workingHoursEnd: '14:30',
    },
    {
      hospitalCode: 'FORT-BLR',
      deptSlug: 'pediatrics',
      name: 'Dr. Sunita Rao',
      email: 'dr.sunita@fortis.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1594824813571-638ef061a998?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, DCH, DNB (Pediatrics), MRCPCH (London)',
      specialization: 'Chief Pediatrician & Neonatologist',
      experienceYears: 14,
      consultationFee: 650,
      languages: 'English, Kannada, Hindi',
      about: 'Dedicated pediatric care provider managing childhood asthma, developmental milestones, adolescent healthcare, and pediatric allergies.',
      workingDays: 'Mon,Wed,Thu,Fri,Sat',
      workingHoursStart: '09:00',
      workingHoursEnd: '15:00',
    },

    // Max Super Speciality Saket
    {
      hospitalCode: 'MAX-DEL',
      deptSlug: 'cardiology',
      name: 'Dr. Vikramaditya Reddy',
      email: 'dr.vikram@max.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD, DM, FSCAI (USA)',
      specialization: 'Director - Interventional Cardiology & Structural Heart',
      experienceYears: 22,
      consultationFee: 1000,
      languages: 'English, Hindi, Punjabi',
      about: 'Renowned expert in TAVR, MitraClip, bioresorbable stents, and radial access coronary interventions with international surgical awards.',
      workingDays: 'Mon,Tue,Wed,Thu,Fri',
      workingHoursStart: '09:00',
      workingHoursEnd: '15:00',
    },
    {
      hospitalCode: 'MAX-DEL',
      deptSlug: 'gynecology',
      name: 'Dr. Meenakshi Sundaram',
      email: 'dr.meenakshi@max.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MS (OBG), FICOG, Diploma in Advanced Gynaecological Endoscopy (Germany)',
      specialization: 'Senior Consultant Obstetrician & Laparoscopic Surgeon',
      experienceYears: 17,
      consultationFee: 900,
      languages: 'English, Hindi, Tamil',
      about: 'Specializes in high risk pregnancies, painless natural birth, fibroid treatments, ovarian cysts, and 3D laparoscopic hysterectomy.',
      workingDays: 'Mon,Tue,Thu,Fri,Sat',
      workingHoursStart: '10:00',
      workingHoursEnd: '16:00',
    },
    {
      hospitalCode: 'MAX-DEL',
      deptSlug: 'ent',
      name: 'Dr. Sandeep Verma',
      email: 'dr.sandeep@max.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MS (Otorhinolaryngology)',
      specialization: 'Consultant ENT & Sleep Apnea Specialist',
      experienceYears: 10,
      consultationFee: 700,
      languages: 'English, Hindi',
      about: 'Focused on snoring and obstructive sleep apnea surgeries, allergic rhinitis immunotherapy, and voice disorders.',
      workingDays: 'Tue,Wed,Thu,Fri,Sat',
      workingHoursStart: '11:00',
      workingHoursEnd: '17:00',
    },

    // Manipal Hospital Whitefield
    {
      hospitalCode: 'MANI-BLR',
      deptSlug: 'orthopedics',
      name: 'Dr. Rohan Kapoor',
      email: 'dr.rohan@manipal.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MS (Orthopaedics), Fellowship Sports Injury & Arthroscopy',
      specialization: 'Consultant Orthopedic Surgeon & Sports Medicine',
      experienceYears: 11,
      consultationFee: 750,
      languages: 'English, Hindi, Kannada',
      about: 'Specializes in ACL/PCL reconstruction, shoulder rotator cuff repair, meniscus transplants, and athletic injury recovery.',
      workingDays: 'Mon,Tue,Wed,Fri,Sat',
      workingHoursStart: '09:00',
      workingHoursEnd: '15:00',
    },
    {
      hospitalCode: 'MANI-BLR',
      deptSlug: 'general-medicine',
      name: 'Dr. Kavita Nair',
      email: 'dr.kavita@manipal.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1594824813571-638ef061a998?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, DNB (General Medicine)',
      specialization: 'Senior Physician & Preventive Health Specialist',
      experienceYears: 13,
      consultationFee: 600,
      languages: 'English, Malayalam, Kannada, Hindi',
      about: 'Clinical mentor focused on adult immunization, metabolic syndrome reversal, chronic hypertension, and post-viral recovery.',
      workingDays: 'Mon,Tue,Thu,Fri,Sat',
      workingHoursStart: '08:30',
      workingHoursEnd: '14:30',
    },
    {
      hospitalCode: 'MANI-BLR',
      deptSlug: 'dermatology',
      name: 'Dr. Shalini Mukherjee',
      email: 'dr.shalini@manipal.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD (DVL)',
      specialization: 'Consultant Dermatologist',
      experienceYears: 8,
      consultationFee: 650,
      languages: 'English, Bengali, Hindi, Kannada',
      about: 'Focus on pediatric eczema, contact dermatitis, pigmentation treatment, and auto-immune skin conditions.',
      workingDays: 'Tue,Wed,Thu,Sat',
      workingHoursStart: '10:00',
      workingHoursEnd: '16:00',
    },

    // AIIMS New Delhi
    {
      hospitalCode: 'AIIMS-DEL',
      deptSlug: 'cardiology',
      name: 'Dr. Deepa Krishnan',
      email: 'dr.deepa@aiims.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD, DM (AIIMS), FACC',
      specialization: 'Professor & Head of Preventive Cardiology',
      experienceYears: 24,
      consultationFee: 300,
      languages: 'English, Hindi, Tamil',
      about: 'Distinguished professor with vast experience in complex congenital heart anomalies, heart failure management, and clinical cardiology.',
      workingDays: 'Mon,Tue,Wed,Thu,Fri',
      workingHoursStart: '08:00',
      workingHoursEnd: '14:00',
    },
    {
      hospitalCode: 'AIIMS-DEL',
      deptSlug: 'neurology',
      name: 'Dr. Harish Chandra',
      email: 'dr.harish@aiims.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD, DM (Neurology)',
      specialization: 'Additional Professor - Cognitive & Clinical Neurosciences',
      experienceYears: 19,
      consultationFee: 300,
      languages: 'English, Hindi',
      about: 'Author of prominent neurological publications, focusing on dementia, ALS, neuroimmunology, and movement disorders.',
      workingDays: 'Mon,Wed,Thu,Sat',
      workingHoursStart: '08:30',
      workingHoursEnd: '14:00',
    },
    {
      hospitalCode: 'AIIMS-DEL',
      deptSlug: 'gynecology',
      name: 'Dr. Neha Bansal',
      email: 'dr.neha@aiims.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1594824813571-638ef061a998?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MS, DNB, Fellowship Maternal-Fetal Medicine',
      specialization: 'Associate Professor - Fetal Medicine & High Risk Obstetrics',
      experienceYears: 15,
      consultationFee: 300,
      languages: 'English, Hindi, Punjabi',
      about: 'Leading authority in prenatal diagnosis, fetal anomaly scans, intra-uterine interventions, and adolescent reproductive health.',
      workingDays: 'Tue,Thu,Fri,Sat',
      workingHoursStart: '09:00',
      workingHoursEnd: '14:00',
    },
    {
      hospitalCode: 'AIIMS-DEL',
      deptSlug: 'pediatrics',
      name: 'Dr. Alok Gupta',
      email: 'dr.alok@aiims.medipulse.org',
      photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&auto=format&fit=crop&q=80',
      qualification: 'MBBS, MD (Pediatrics, AIIMS), Fellow Pediatric Critical Care',
      specialization: 'Senior Pediatric Intensivist',
      experienceYears: 16,
      consultationFee: 300,
      languages: 'English, Hindi',
      about: 'Pioneered advanced pediatric mechanical ventilation protocols, pediatric emergency triage, and infectious disease management.',
      workingDays: 'Mon,Tue,Wed,Fri,Sat',
      workingHoursStart: '08:30',
      workingHoursEnd: '14:00',
    },
  ];

  const createdDoctors: any[] = [];

  for (const d of doctorsData) {
    const hospital = createdHospitals.find((h) => h.code === d.hospitalCode);
    if (!hospital) continue;

    const department = await prisma.department.findFirst({
      where: { hospitalId: hospital.id, slug: d.deptSlug },
    });
    if (!department) continue;

    const docStatus = (d as any).status || 'ACTIVE';
    const docIsActive = docStatus === 'ACTIVE';

    // Create user account for doctor
    const doctorUser = await prisma.user.create({
      data: {
        email: d.email,
        passwordHash: defaultPasswordHash,
        role: 'DOCTOR',
        name: d.name,
        phone: '+91 98111 22334',
        status: docStatus,
        isActive: docIsActive,
      },
    });

    // Create doctor
    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        hospitalId: hospital.id,
        departmentId: department.id,
        name: d.name,
        photoUrl: d.photoUrl,
        qualification: d.qualification,
        specialization: d.specialization,
        experienceYears: d.experienceYears,
        consultationFee: d.consultationFee,
        languages: d.languages,
        about: d.about,
        workingDays: d.workingDays,
        workingHoursStart: d.workingHoursStart,
        workingHoursEnd: d.workingHoursEnd,
        slotDurationMinutes: 30,
        breakStart: '13:00',
        breakEnd: '14:00',
        status: docStatus,
        isActive: docIsActive,
      },
    });
    createdDoctors.push(doctor);

    // Create default schedules for working days
    const dayMap: { [key: string]: number } = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const days = d.workingDays.split(',');
    for (const dayStr of days) {
      const dayIdx = dayMap[dayStr.trim()];
      if (dayIdx !== undefined) {
        await prisma.doctorSchedule.create({
          data: {
            doctorId: doctor.id,
            dayOfWeek: dayIdx,
            startTime: d.workingHoursStart,
            endTime: d.workingHoursEnd,
            slotDurationMinutes: 30,
            isAvailable: true,
          },
        });
      }
    }

    // Add doctor review
    await prisma.review.create({
      data: {
        doctorId: doctor.id,
        hospitalId: hospital.id,
        patientName: 'Anil Kumar K.',
        rating: 5,
        comment: `Excellent consultation with ${d.name}. Took time to explain the diagnosis clearly and suggested effective treatment without unnecessary tests.`,
      },
    });
  }

  console.log(`✅ Created ${createdDoctors.length} Doctors with schedules and reviews`);

  // 4. Sample Patients
  const patientsData = [
    {
      fullName: 'Vikram Joshi',
      mobileNumber: '9845012345',
      email: 'vikram.joshi@example.com',
      dateOfBirth: '1988-04-14',
      gender: 'Male',
      address: 'Plot 42, HSR Layout, Sector 2, Bengaluru',
      bloodGroup: 'B+',
      emergencyContact: '+91 98450 99999',
    },
    {
      fullName: 'Deepika Sen',
      mobileNumber: '9988776655',
      email: 'deepika.sen@example.com',
      dateOfBirth: '1994-08-22',
      gender: 'Female',
      address: 'Tower 4, Flat 302, DLF Phase 5, Gurugram',
      bloodGroup: 'O+',
      emergencyContact: '+91 99887 00000',
    },
    {
      fullName: 'Rameshwar Patidar',
      mobileNumber: '9123456780',
      email: 'rameshwar.p@example.com',
      dateOfBirth: '1975-11-03',
      gender: 'Male',
      address: 'B-12, Banjara Hills Road No 10, Hyderabad',
      bloodGroup: 'AB+',
      emergencyContact: '+91 91234 11111',
    },
    {
      fullName: 'Meera Iyer',
      mobileNumber: '9876543201',
      email: 'meera.iyer@example.com',
      dateOfBirth: '1999-01-19',
      gender: 'Female',
      address: 'Flat 104, Green Glen Layout, Bellandur, Bengaluru',
      bloodGroup: 'A+',
      emergencyContact: '+91 98765 22222',
    },
  ];

  const createdPatients: any[] = [];
  for (const p of patientsData) {
    const patient = await prisma.patient.create({ data: p });
    createdPatients.push(patient);
  }

  // 5. Sample Confirmed Appointments with Payments and Digital OP
  const today = '2026-09-26';
  const apolloDoc = createdDoctors.find((d) => d.name === 'Dr. Rahul Kumar');
  const fortisDoc = createdDoctors.find((d) => d.name === 'Dr. Rajesh Mehta');
  const maxDoc = createdDoctors.find((d) => d.name === 'Dr. Vikramaditya Reddy');

  if (apolloDoc && createdPatients.length >= 2) {
    // Appointment 1: In consultation today
    const apt1Number = 'APT-2026-0926-001';
    const op1Number = 'OP-2026-0926-000101';
    const secureToken1 = crypto.randomBytes(16).toString('hex');

    const apt1 = await prisma.appointment.create({
      data: {
        appointmentNumber: apt1Number,
        hospitalId: apolloDoc.hospitalId,
        doctorId: apolloDoc.id,
        patientId: createdPatients[0].id,
        departmentId: apolloDoc.departmentId,
        appointmentDate: today,
        timeSlot: '10:00 AM',
        tokenNumber: 1,
        status: 'IN_CONSULTATION',
        consultationFee: apolloDoc.consultationFee,
        platformFee: 20,
        totalAmount: apolloDoc.consultationFee + 20,
        notes: 'Routine cardiac health review and follow-up on treadmill test results.',
      },
    });

    await prisma.payment.create({
      data: {
        appointmentId: apt1.id,
        razorpayOrderId: 'order_apollo_demo_001',
        razorpayPaymentId: 'pay_apollo_demo_001',
        razorpaySignature: 'sig_apollo_demo_001',
        amount: apolloDoc.consultationFee + 20,
        currency: 'INR',
        status: 'SUCCESS',
        paymentMethod: 'UPI',
        idempotencyKey: `idemp_${apt1.id}`,
      },
    });

    await prisma.digitalOP.create({
      data: {
        opNumber: op1Number,
        secureToken: secureToken1,
        appointmentId: apt1.id,
        qrData: `http://localhost:5173/verify-op/${secureToken1}`,
        isVerified: false,
      },
    });

    await prisma.notification.create({
      data: {
        hospitalId: apolloDoc.hospitalId,
        recipientType: 'HOSPITAL_ADMIN',
        title: 'New Appointment Booked',
        message: `Patient ${createdPatients[0].fullName} booked appointment with ${apolloDoc.name} for ${today} at 10:00 AM. OP: ${op1Number}`,
        type: 'NEW_APPOINTMENT',
        metadata: JSON.stringify({
          appointmentId: apt1.id,
          opNumber: op1Number,
          patientName: createdPatients[0].fullName,
          doctorName: apolloDoc.name,
          amount: apolloDoc.consultationFee + 20,
        }),
      },
    });

    // Appointment 2: Waiting today
    const apt2Number = 'APT-2026-0926-002';
    const op2Number = 'OP-2026-0926-000102';
    const secureToken2 = crypto.randomBytes(16).toString('hex');

    const apt2 = await prisma.appointment.create({
      data: {
        appointmentNumber: apt2Number,
        hospitalId: apolloDoc.hospitalId,
        doctorId: apolloDoc.id,
        patientId: createdPatients[2].id,
        departmentId: apolloDoc.departmentId,
        appointmentDate: today,
        timeSlot: '10:30 AM',
        tokenNumber: 2,
        status: 'WAITING',
        consultationFee: apolloDoc.consultationFee,
        platformFee: 20,
        totalAmount: apolloDoc.consultationFee + 20,
        notes: 'Mild chest tightness on exertion for 3 days.',
      },
    });

    await prisma.payment.create({
      data: {
        appointmentId: apt2.id,
        razorpayOrderId: 'order_apollo_demo_002',
        razorpayPaymentId: 'pay_apollo_demo_002',
        razorpaySignature: 'sig_apollo_demo_002',
        amount: apolloDoc.consultationFee + 20,
        currency: 'INR',
        status: 'SUCCESS',
        paymentMethod: 'Card',
        idempotencyKey: `idemp_${apt2.id}`,
      },
    });

    await prisma.digitalOP.create({
      data: {
        opNumber: op2Number,
        secureToken: secureToken2,
        appointmentId: apt2.id,
        qrData: `http://localhost:5173/verify-op/${secureToken2}`,
        isVerified: false,
      },
    });

    await prisma.notification.create({
      data: {
        hospitalId: apolloDoc.hospitalId,
        recipientType: 'HOSPITAL_ADMIN',
        title: 'New Appointment Booked',
        message: `Patient ${createdPatients[2].fullName} booked appointment with ${apolloDoc.name} for ${today} at 10:30 AM. OP: ${op2Number}`,
        type: 'NEW_APPOINTMENT',
        metadata: JSON.stringify({
          appointmentId: apt2.id,
          opNumber: op2Number,
          patientName: createdPatients[2].fullName,
          doctorName: apolloDoc.name,
          amount: apolloDoc.consultationFee + 20,
        }),
      },
    });
  }

  if (fortisDoc && createdPatients.length >= 2) {
    const apt3Number = 'APT-2026-0926-003';
    const op3Number = 'OP-2026-0926-000103';
    const secureToken3 = crypto.randomBytes(16).toString('hex');

    const apt3 = await prisma.appointment.create({
      data: {
        appointmentNumber: apt3Number,
        hospitalId: fortisDoc.hospitalId,
        doctorId: fortisDoc.id,
        patientId: createdPatients[1].id,
        departmentId: fortisDoc.departmentId,
        appointmentDate: today,
        timeSlot: '11:00 AM',
        tokenNumber: 1,
        status: 'COMPLETED',
        consultationFee: fortisDoc.consultationFee,
        platformFee: 20,
        totalAmount: fortisDoc.consultationFee + 20,
        notes: 'Seasonal cough, fever, and generalized fatigue.',
      },
    });

    await prisma.payment.create({
      data: {
        appointmentId: apt3.id,
        razorpayOrderId: 'order_fortis_demo_001',
        razorpayPaymentId: 'pay_fortis_demo_001',
        razorpaySignature: 'sig_fortis_demo_001',
        amount: fortisDoc.consultationFee + 20,
        currency: 'INR',
        status: 'SUCCESS',
        paymentMethod: 'UPI',
        idempotencyKey: `idemp_${apt3.id}`,
      },
    });

    await prisma.digitalOP.create({
      data: {
        opNumber: op3Number,
        secureToken: secureToken3,
        appointmentId: apt3.id,
        qrData: `http://localhost:5173/verify-op/${secureToken3}`,
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    // Sample prescription
    await prisma.prescription.create({
      data: {
        appointmentId: apt3.id,
        doctorId: fortisDoc.id,
        diagnosis: 'Acute Upper Respiratory Tract Infection (Viral Rhinosinusitis)',
        medicines: JSON.stringify([
          { name: 'Tab Paracetamol 650mg', dosage: '1 tablet', frequency: 'TDS (Thrice daily)', duration: '5 days', instructions: 'After food' },
          { name: 'Tab Levocetirizine 5mg', dosage: '1 tablet', frequency: 'Once daily at night', duration: '5 days', instructions: 'Before sleep' },
          { name: 'Steam Inhalation', dosage: 'Plain water steam', frequency: 'BD (Twice daily)', duration: '5 days', instructions: '10 mins' },
        ]),
        instructions: 'Drink warm fluids, avoid cold beverages, and rest well. Review if fever persists beyond 3 days.',
        followUpDate: '2026-10-03',
      },
    });

    // Sample Medical Record
    await prisma.medicalRecord.create({
      data: {
        appointmentId: apt3.id,
        patientId: createdPatients[1].id,
        symptoms: 'Fever 101F, running nose, dry cough for 2 days',
        vitals: JSON.stringify({ bp: '120/80 mmHg', pulse: '82 bpm', temperature: '99.2 F', weight: '58 kg', spo2: '99%' }),
        clinicalNotes: 'Throat mildly congested. Chest clear, bilaterally vesicular breath sounds. No wheeze.',
      },
    });
  }

  console.log('✅ Seed completed successfully!');
  console.log('\n=============================================');
  console.log('SAMPLE DEMO CREDENTIALS:');
  console.log('---------------------------------------------');
  console.log('Super Admin:');
  console.log('  Email:    superadmin@medipulse.org');
  console.log('  Password: Password@123');
  console.log('\nHospital Admins:');
  console.log('  Apollo:   admin.apollo@medipulse.org  (Password@123)');
  console.log('  Fortis:   admin.fortis@medipulse.org  (Password@123)');
  console.log('  Max:      admin.max@medipulse.org     (Password@123)');
  console.log('  Manipal:  admin.manipal@medipulse.org (Password@123)');
  console.log('  AIIMS:    admin.aiims@medipulse.org   (Password@123)');
  console.log('\nDoctor Accounts:');
  console.log('  Apollo:   dr.rahul@apollo.medipulse.org   (Password@123)');
  console.log('  Fortis:   dr.rajesh@fortis.medipulse.org  (Password@123)');
  console.log('  Max:      dr.vikram@max.medipulse.org     (Password@123)');
  console.log('=============================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
