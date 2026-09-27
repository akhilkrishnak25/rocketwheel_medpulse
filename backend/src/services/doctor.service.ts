import prisma from '../config/prisma';

export class DoctorService {
  static async listDoctors(query: {
    hospitalId?: string;
    departmentId?: string;
    search?: string;
    city?: string;
    specialization?: string;
    sortBy?: 'fee_asc' | 'fee_desc' | 'rating_desc' | 'experience_desc';
  } = {}) {
    const where: any = {
      isActive: true,
      status: 'ACTIVE',
      hospital: {
        status: 'ACTIVE',
      },
    };

    if (query.hospitalId) where.hospitalId = query.hospitalId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.city) {
      where.hospital = { ...where.hospital, city: { contains: query.city } };
    }
    if (query.specialization) {
      where.specialization = { contains: query.specialization };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { specialization: { contains: query.search } },
        { qualification: { contains: query.search } },
        { department: { name: { contains: query.search } } },
        { hospital: { name: { contains: query.search } } },
      ];
    }

    let orderBy: any = [{ experienceYears: 'desc' }, { name: 'asc' }];
    if (query.sortBy === 'fee_asc') orderBy = [{ consultationFee: 'asc' }];
    if (query.sortBy === 'fee_desc') orderBy = [{ consultationFee: 'desc' }];
    if (query.sortBy === 'experience_desc') orderBy = [{ experienceYears: 'desc' }];

    const doctors = await prisma.doctor.findMany({
      where,
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            code: true,
            rating: true,
            logoUrl: true,
          },
        },
        department: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        reviews: {
          select: { rating: true },
        },
      },
      orderBy,
    });

    return doctors.map((doc) => {
      const avg =
        doc.reviews.length > 0
          ? doc.reviews.reduce((s, r) => s + r.rating, 0) / doc.reviews.length
          : 4.8;
      const { reviews, ...rest } = doc;
      return {
        ...rest,
        averageRating: Number(avg.toFixed(1)),
        reviewCount: reviews.length,
      };
    });
  }

  static async getDoctorById(id: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            address: true,
            city: true,
            phone: true,
            emergencyContact: true,
            rating: true,
            imageUrl: true,
            logoUrl: true,
            status: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        schedules: {
          orderBy: { dayOfWeek: 'asc' },
        },
        leaves: {
          where: {
            endDate: { gte: new Date() },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!doctor || !doctor.isActive || doctor.status !== 'ACTIVE') return null;
    if (doctor.hospital && (doctor.hospital as any).status !== 'ACTIVE') return null;

    const ratingAvg =
      doctor.reviews.length > 0
        ? doctor.reviews.reduce((acc, r) => acc + r.rating, 0) / doctor.reviews.length
        : 4.8;

    return {
      ...doctor,
      averageRating: Number(ratingAvg.toFixed(1)),
      reviewCount: doctor.reviews.length,
    };
  }

  /**
   * Automatically calculates available time slots for a doctor on a given date (YYYY-MM-DD)
   * taking into account working days, working hours, break periods, doctor leave,
   * existing confirmed appointments, and temporarily locked slots.
   */
  static async getAvailableSlots(doctorId: string, dateString: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        schedules: true,
        leaves: true,
      },
    });

    if (!doctor || !doctor.isActive) {
      throw new Error('Doctor not found or inactive');
    }

    const targetDate = new Date(`${dateString}T00:00:00.000Z`);
    const dayOfWeek = targetDate.getUTCDay(); // 0 = Sun, 1 = Mon, ...

    // 1. Check if doctor is on approved leave for this date
    const isOnLeave = doctor.leaves.some((l) => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      return targetDate >= start && targetDate <= end;
    });

    if (isOnLeave) {
      return {
        date: dateString,
        isWorkingDay: false,
        reason: 'Doctor is on leave on this date',
        slots: [],
      };
    }

    // 2. Check schedule for this day of week
    const specificSchedule = doctor.schedules.find((s) => s.dayOfWeek === dayOfWeek);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDayName = dayNames[dayOfWeek];
    const workingDaysList = doctor.workingDays.split(',').map((s) => s.trim());

    const isAvailableToday =
      (specificSchedule ? specificSchedule.isAvailable : false) ||
      workingDaysList.includes(currentDayName);

    if (!isAvailableToday) {
      return {
        date: dateString,
        isWorkingDay: false,
        reason: `Doctor does not consult on ${currentDayName}days`,
        slots: [],
      };
    }

    // Determine working hours & slot duration
    const startTimeStr = specificSchedule?.startTime || doctor.workingHoursStart || '09:00';
    const endTimeStr = specificSchedule?.endTime || doctor.workingHoursEnd || '17:00';
    const slotDuration = specificSchedule?.slotDurationMinutes || doctor.slotDurationMinutes || 30;
    const breakStart = doctor.breakStart || '13:00';
    const breakEnd = doctor.breakEnd || '14:00';

    // 3. Fetch existing appointments for this doctor on this date
    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: dateString,
        status: { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'PENDING_PAYMENT'] },
      },
      select: {
        timeSlot: true,
        status: true,
        createdAt: true,
      },
    });

    // Clean up expired pending payments (older than 15 minutes)
    const nowTime = new Date().getTime();
    const activeBookedSlots = new Set<string>();

    for (const apt of bookedAppointments) {
      if (apt.status === 'PENDING_PAYMENT') {
        const ageMinutes = (nowTime - new Date(apt.createdAt).getTime()) / (1000 * 60);
        if (ageMinutes < 15) {
          activeBookedSlots.add(apt.timeSlot);
        }
      } else {
        activeBookedSlots.add(apt.timeSlot);
      }
    }

    // 4. Generate all interval slots
    const parseMinutes = (time24: string) => {
      const [h, m] = time24.split(':').map(Number);
      return h * 60 + m;
    };

    const formatTimeSlot = (minutes: number) => {
      const h24 = Math.floor(minutes / 60);
      const m = minutes % 60;
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    };

    const startMinutes = parseMinutes(startTimeStr);
    const endMinutes = parseMinutes(endTimeStr);
    const breakStartMin = parseMinutes(breakStart);
    const breakEndMin = parseMinutes(breakEnd);

    const slots: Array<{
      time: string;
      time24: string;
      isAvailable: boolean;
      status: 'AVAILABLE' | 'BOOKED' | 'BREAK';
    }> = [];

    for (let current = startMinutes; current + slotDuration <= endMinutes; current += slotDuration) {
      const formattedSlot = formatTimeSlot(current);
      const hour24 = Math.floor(current / 60);
      const min = current % 60;
      const time24Str = `${String(hour24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      // Check if slot falls in break
      if (current >= breakStartMin && current < breakEndMin) {
        slots.push({
          time: formattedSlot,
          time24: time24Str,
          isAvailable: false,
          status: 'BREAK',
        });
        continue;
      }

      // Check if already booked
      const isBooked = activeBookedSlots.has(formattedSlot) || activeBookedSlots.has(time24Str);

      slots.push({
        time: formattedSlot,
        time24: time24Str,
        isAvailable: !isBooked,
        status: isBooked ? 'BOOKED' : 'AVAILABLE',
      });
    }

    return {
      date: dateString,
      isWorkingDay: true,
      doctorName: doctor.name,
      consultationFee: doctor.consultationFee,
      slotDurationMinutes: slotDuration,
      totalSlots: slots.length,
      availableCount: slots.filter((s) => s.isAvailable).length,
      slots,
    };
  }
}
