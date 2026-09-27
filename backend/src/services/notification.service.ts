import prisma from '../config/prisma';

export interface NewAppointmentNotificationParams {
  hospitalId: string;
  patientName: string;
  patientEmail: string;
  patientMobile: string;
  doctorName: string;
  departmentName: string;
  appointmentDate: string;
  timeSlot: string;
  opNumber: string;
  totalAmount: number;
  appointmentId: string;
}

export class NotificationService {
  /**
   * System notification for Hospital Admin upon verified payment
   */
  static async notifyHospitalAdminOfBooking(params: NewAppointmentNotificationParams) {
    const formattedMessage = [
      `NEW APPOINTMENT`,
      ``,
      `Patient: ${params.patientName}`,
      `Doctor: ${params.doctorName}`,
      `Department: ${params.departmentName}`,
      `Date: ${params.appointmentDate}`,
      `Time: ${params.timeSlot}`,
      `OP: ${params.opNumber}`,
      `Payment: ₹${params.totalAmount} — SUCCESS`,
    ].join('\n');

    const notification = await prisma.notification.create({
      data: {
        hospitalId: params.hospitalId,
        recipientType: 'HOSPITAL_ADMIN',
        title: 'New Appointment Booked',
        message: formattedMessage,
        type: 'NEW_APPOINTMENT',
        metadata: JSON.stringify({
          appointmentId: params.appointmentId,
          opNumber: params.opNumber,
          patientName: params.patientName,
          patientMobile: params.patientMobile,
          doctorName: params.doctorName,
          amount: params.totalAmount,
        }),
      },
    });

    // Simulate / send patient email dispatch (modular interface)
    this.sendPatientConfirmationEmail(params);

    return notification;
  }

  static async sendPatientConfirmationEmail(params: NewAppointmentNotificationParams) {
    // Modular email logger / dispatcher
    console.log(`\n📧 [EMAIL DISPATCH] To: ${params.patientEmail}`);
    console.log(`Subject: Confirmed: Your Doctor Appointment at MediPulse - OP ${params.opNumber}`);
    console.log(`Dear ${params.patientName}, your appointment with ${params.doctorName} on ${params.appointmentDate} at ${params.timeSlot} is confirmed. Digital OP: ${params.opNumber}.\n`);
  }

  static async getHospitalNotifications(hospitalId: string) {
    return prisma.notification.findMany({
      where: { hospitalId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  static async markAsRead(notificationId: string) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static async markAllAsRead(hospitalId: string) {
    return prisma.notification.updateMany({
      where: { hospitalId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
