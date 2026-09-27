import prisma from '../config/prisma';

export interface HospitalFilters {
  search?: string;
  city?: string;
  department?: string;
  isEmergencyAvailable?: boolean;
  minRating?: number;
  sortBy?: 'rating_desc' | 'name_asc' | 'doctors_desc';
}

export class HospitalService {
  static async getAllHospitals(filters: HospitalFilters = {}) {
    const { search, city, department, isEmergencyAvailable, minRating, sortBy = 'rating_desc' } = filters;

    const whereClause: any = {
      status: 'ACTIVE',
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { city: { contains: search } },
        { address: { contains: search } },
        {
          departments: {
            some: {
              name: { contains: search },
            },
          },
        },
        {
          doctors: {
            some: {
              name: { contains: search },
              status: 'ACTIVE',
              isActive: true,
            },
          },
        },
      ];
    }

    if (city) {
      whereClause.city = { contains: city };
    }

    if (isEmergencyAvailable !== undefined) {
      whereClause.isEmergencyAvailable = isEmergencyAvailable;
    }

    if (minRating) {
      whereClause.rating = { gte: minRating };
    }

    if (department) {
      whereClause.departments = {
        some: {
          slug: department,
        },
      };
    }

    let orderBy: any = { rating: 'desc' };
    if (sortBy === 'name_asc') orderBy = { name: 'asc' };
    if (sortBy === 'rating_desc') orderBy = { rating: 'desc' };

    const hospitals = await prisma.hospital.findMany({
      where: whereClause,
      include: {
        departments: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        doctors: {
          where: { isActive: true, status: 'ACTIVE' },
          select: { id: true, name: true, specialization: true, consultationFee: true },
        },
      },
      orderBy,
    });

    return hospitals.map((h) => ({
      id: h.id,
      name: h.name,
      slug: h.slug,
      code: h.code,
      logoUrl: h.logoUrl,
      imageUrl: h.imageUrl,
      address: h.address,
      city: h.city,
      state: h.state,
      pincode: h.pincode,
      phone: h.phone,
      emergencyContact: h.emergencyContact,
      openingHours: h.openingHours,
      about: h.about,
      facilities: JSON.parse(h.facilities || '[]'),
      rating: h.rating,
      isEmergencyAvailable: h.isEmergencyAvailable,
      doctorCount: h.doctors.length,
      departments: h.departments,
      minConsultationFee: h.doctors.length > 0
        ? Math.min(...h.doctors.map((d) => d.consultationFee))
        : 400,
    }));
  }

  static async getHospitalByIdOrSlug(idOrSlug: string) {
    const hospital = await prisma.hospital.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        departments: {
          select: { id: true, name: true, slug: true, code: true, description: true, icon: true },
        },
        doctors: {
          where: { isActive: true, status: 'ACTIVE' },
          include: {
            department: {
              select: { id: true, name: true, slug: true },
            },
            reviews: {
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!hospital) return null;

    return {
      ...hospital,
      facilities: JSON.parse(hospital.facilities || '[]'),
      doctorCount: hospital.doctors.length,
    };
  }

  static async getHospitalDoctors(hospitalId: string, filters: {
    department?: string;
    specialization?: string;
    maxFee?: number;
    search?: string;
  } = {}) {
    const { department, specialization, maxFee, search } = filters;

    // Verify hospital is active
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { status: true },
    });
    if (!hospital || hospital.status !== 'ACTIVE') {
      return [];
    }

    const whereClause: any = {
      hospitalId,
      isActive: true,
      status: 'ACTIVE',
    };

    if (department) {
      whereClause.department = {
        OR: [{ id: department }, { slug: department }],
      };
    }

    if (specialization) {
      whereClause.specialization = { contains: specialization };
    }

    if (maxFee) {
      whereClause.consultationFee = { lte: maxFee };
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { specialization: { contains: search } },
        { qualification: { contains: search } },
      ];
    }

    return prisma.doctor.findMany({
      where: whereClause,
      include: {
        department: {
          select: { id: true, name: true, slug: true },
        },
        reviews: {
          take: 3,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { experienceYears: 'desc' },
    });
  }

  static async getPopularDepartments() {
    return prisma.department.findMany({
      distinct: ['slug'],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
      },
      take: 8,
    });
  }
}
