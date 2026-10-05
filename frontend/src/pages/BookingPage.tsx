import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Building2,
  Stethoscope,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import { doctorsApi } from '../api/doctors.api';
import { appointmentsApi, CreateAppointmentDTO } from '../api/appointments.api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';

const patientSchema = z.object({
  fullName: z.string().min(2, 'Full Name is required (minimum 2 characters)'),
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  email: z.string().email('Please enter a valid email address'),
  age: z
    .coerce
    .number({ invalid_type_error: 'Age is required' })
    .int('Age must be a whole number')
    .min(1, 'Age must be between 1 and 125')
    .max(125, 'Age must be between 1 and 125'),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContact: z.string().optional(),
  notes: z.string().max(500, 'Max 500 characters').optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

export const BookingPage: React.FC = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Smooth scroll to top whenever booking step advances or retreats
  React.useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [step]);

  const { data: doctor, isLoading: doctorLoading } = useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: () => doctorsApi.getById(doctorId!),
    enabled: !!doctorId,
  });

  const nextDates = React.useMemo(() => {
    const dates: Array<{ dateString: string; dayName: string; dayNumber: number; monthName: string }> = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNumber = d.getDate();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      dates.push({ dateString, dayName, dayNumber, monthName });
    }
    return dates;
  }, []);

  useEffect(() => {
    if (nextDates.length > 0 && !selectedDate) {
      setSelectedDate(nextDates[0].dateString);
    }
  }, [nextDates, selectedDate]);

  const { data: availability, isLoading: slotsLoading } = useQuery({
    queryKey: ['doctor-slots', doctorId, selectedDate],
    queryFn: () => doctorsApi.getAvailability(doctorId!, selectedDate),
    enabled: !!doctorId && !!selectedDate,
  });

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot('');
  };

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      gender: 'Male',
      bloodGroup: 'B+',
    },
  });

  const onPatientFormSubmit = () => {
    setStep(4);
  };

  const handlePaymentInitiate = async () => {
    if (!doctor || !selectedDate || !selectedSlot) return;

    setIsProcessingPayment(true);
    setPaymentError(null);

    const formData = getValues();

    try {
      const bookingPayload: CreateAppointmentDTO = {
        hospitalId: doctor.hospitalId,
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        appointmentDate: selectedDate,
        timeSlot: selectedSlot,
        patient: {
          fullName: formData.fullName,
          mobileNumber: formData.mobileNumber,
          email: formData.email,
          age: Number(formData.age),
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          address: formData.address,
          bloodGroup: formData.bloodGroup,
          emergencyContact: formData.emergencyContact,
        },
        notes: formData.notes,
      };

      const pendingRes = await appointmentsApi.create(bookingPayload);
      const { appointment, paymentOrder } = pendingRes;

      const options = {
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: doctor.hospital?.name || 'Rocket Wheel Healthcare',
        description: `OPD Consultation - ${doctor.name}`,
        order_id: paymentOrder.orderId,
        prefill: {
          name: formData.fullName,
          email: formData.email,
          contact: formData.mobileNumber,
        },
        theme: {
          color: '#1E20E0', // Rocket Wheel Signature Electric Royal Blue
        },
        handler: async function (response: any) {
          try {
            await appointmentsApi.confirmPayment({
              appointmentId: appointment.id,
              razorpayOrderId: response.razorpay_order_id || paymentOrder.orderId,
              razorpayPaymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
              razorpaySignature:
                response.razorpay_signature || `simulated_sig_${paymentOrder.orderId}`,
            });

            toast.success('Appointment Confirmed!', 'Digital OP slip generated');
            navigate(`/appointments/${appointment.id}/confirmed`);
          } catch (err: any) {
            setPaymentError(err.message || 'Payment signature verification failed.');
            setIsProcessingPayment(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
            setPaymentError('Payment window was closed. Your appointment is pending payment.');
          },
        },
      };

      const razorpayInstance = (window as any).Razorpay ? new (window as any).Razorpay(options) : null;

      if (razorpayInstance && paymentOrder.keyId.startsWith('rzp_live_')) {
        razorpayInstance.open();
      } else {
        setTimeout(async () => {
          try {
            const simulatedPaymentId = `pay_rzp_test_${Date.now()}`;
            const simulatedSignature = `simulated_sig_${paymentOrder.orderId}`;

            await appointmentsApi.confirmPayment({
              appointmentId: appointment.id,
              razorpayOrderId: paymentOrder.orderId,
              razorpayPaymentId: simulatedPaymentId,
              razorpaySignature: simulatedSignature,
            });

            toast.success('Payment Verified!', 'Digital OP slip generated');
            navigate(`/appointments/${appointment.id}/confirmed`);
          } catch (err: any) {
            setPaymentError(err.message || 'Payment verification failed.');
            setIsProcessingPayment(false);
          }
        }, 1200);
      }
    } catch (err: any) {
      setIsProcessingPayment(false);
      setPaymentError(err.message || 'Failed to initialize appointment or lock slot.');
      toast.error('Booking Error', err.message);
    }
  };

  if (doctorLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-royal-600 mx-auto"></div>
        <p className="text-sm text-slate-500 mt-4">Loading doctor scheduling system...</p>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <h2 className="text-xl font-bold text-slate-900">Doctor not found</h2>
        <Link to="/hospitals" className="mt-4 inline-block">
          <Button variant="primary">Return to Hospitals</Button>
        </Link>
      </div>
    );
  }

  const platformFee = 20;
  const totalAmount = doctor.consultationFee + platformFee;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* HEADER / DOCTOR INFO SNIPPET */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={doctor.photoUrl || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80'}
            alt={doctor.name}
            className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white bg-royal-600 px-2 py-0.5 rounded-md">
                {doctor.department?.name}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-600 font-semibold">
                {doctor.hospital?.name}
              </span>
            </div>
            <h1 className="text-lg font-black text-slate-900 mt-0.5">{doctor.name}</h1>
            <p className="text-xs text-royal-600 font-bold">{doctor.specialization}</p>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Consultation Fee
          </div>
          <div className="text-xl font-black text-slate-900">₹{doctor.consultationFee}</div>
        </div>
      </div>

      {/* MULTI-STEP PROGRESS STEPPER */}
      <div className="flex items-center justify-between relative px-2">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-0 -translate-y-1/2"></div>
        {[
          { num: 1, label: 'Date' },
          { num: 2, label: 'Time Slot' },
          { num: 3, label: 'Patient Info' },
          { num: 4, label: 'Summary' },
          { num: 5, label: 'Payment' },
        ].map((s) => {
          const isDone = step > s.num;
          const isCurrent = step === s.num;
          return (
            <div key={s.num} className="relative z-10 flex flex-col items-center bg-slate-50 px-2">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                  isDone
                    ? 'bg-[#FF1D6B] text-white shadow-sm'
                    : isCurrent
                    ? 'bg-royal-600 text-white ring-4 ring-royal-200 shadow-sm'
                    : 'bg-white text-slate-400 border-2 border-slate-300'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : s.num}
              </div>
              <span
                className={`text-[11px] font-bold mt-1 hidden sm:block ${
                  isCurrent ? 'text-royal-600' : isDone ? 'text-slate-800' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* STEP 1: SELECT DATE */}
      {step === 1 && (
        <Card className="rounded-2xl p-6 space-y-6 border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-royal-600" />
                Step 1: Choose Appointment Date
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select your preferred consultation date from the next 14 days
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:hidden text-[11px] text-slate-400 pb-1">
            <span>Tap or swipe to select date:</span>
            <span className="font-semibold text-royal-600">{selectedDate}</span>
          </div>

          <div className="flex sm:grid overflow-x-auto sm:overflow-visible gap-2.5 sm:gap-3 pb-3 sm:pb-0 no-scrollbar snap-x snap-mandatory sm:grid-cols-4 md:grid-cols-7">
            {nextDates.map((item) => {
              const isSelected = selectedDate === item.dateString;
              return (
                <button
                  key={item.dateString}
                  type="button"
                  onClick={() => handleDateSelect(item.dateString)}
                  className={`flex-shrink-0 w-20 sm:w-auto snap-start p-3 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-royal-600 text-white shadow-md ring-2 ring-royal-600 scale-[1.02]'
                      : 'bg-white border border-slate-200 hover:border-royal-400 hover:bg-royal-50/30 text-slate-700 active:scale-95'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                    {item.dayName}
                  </span>
                  <span className="text-xl font-black my-0.5">{item.dayNumber}</span>
                  <span className={`text-[10px] font-semibold ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    {item.monthName}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              size="md"
              disabled={!selectedDate}
              onClick={() => setStep(2)}
              className="bg-royal-600 hover:bg-royal-700 !text-white text-white font-bold gap-2 shadow-sm"
            >
              <span className="text-white font-bold">Continue to Slots</span> <ArrowRight className="w-4 h-4 text-white" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: SELECT TIME SLOT */}
      {step === 2 && (
        <Card className="rounded-2xl p-6 space-y-6 border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-royal-600" />
                Step 2: Choose Consultation Time Slot
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Date selected: <strong className="text-slate-900">{selectedDate}</strong>
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-royal-600 font-bold hover:underline"
            >
              Change Date
            </button>
          </div>

          {slotsLoading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-royal-600 mx-auto"></div>
              <p className="text-xs text-slate-500 mt-2">Checking doctor's live schedule & appointments...</p>
            </div>
          ) : !availability?.isWorkingDay ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="font-bold text-slate-900 text-sm">Doctor Unavailable on this Date</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {availability?.reason || 'The doctor does not have consultation hours on the selected date.'}
              </p>
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                Select Another Date
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>
                  {availability.availableCount} of {availability.totalSlots} slots available
                </span>
                <span className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 font-semibold text-royal-600">
                    <span className="w-3 h-3 rounded-full bg-royal-600"></span> Available
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-slate-400">
                    <span className="w-3 h-3 rounded-full bg-slate-200"></span> Booked / Break
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {availability.slots.map((slot) => {
                  const isSelected = selectedSlot === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.isAvailable}
                      onClick={() => setSelectedSlot(slot.time)}
                      className={`p-3 rounded-xl text-center text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-royal-600 text-white border-royal-600 shadow-md ring-2 ring-royal-200'
                          : slot.isAvailable
                          ? 'bg-white text-slate-800 border-slate-200 hover:border-royal-500 hover:bg-royal-50/50'
                          : 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div>{slot.time}</div>
                      <div className="text-[10px] font-normal mt-0.5">
                        {slot.status === 'BOOKED'
                          ? 'Booked'
                          : slot.status === 'BREAK'
                          ? 'Break Time'
                          : 'Available'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button variant="outline" size="md" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dates
            </Button>
            <Button
              size="md"
              disabled={!selectedSlot}
              onClick={() => setStep(3)}
              className="bg-royal-600 hover:bg-royal-700 !text-white text-white font-bold gap-2 shadow-sm"
            >
              <span className="text-white font-bold">Enter Patient Details</span> <ArrowRight className="w-4 h-4 text-white" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: GUEST PATIENT DETAILS FORM */}
      {step === 3 && (
        <Card className="rounded-2xl p-6 space-y-6 border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-royal-600" />
                Step 3: Patient Information (No Login Required)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Slots reserved for: <strong className="text-slate-900">{selectedDate} at {selectedSlot}</strong>
              </p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="text-xs text-royal-600 font-bold hover:underline"
            >
              Change Slot
            </button>
          </div>

          <form onSubmit={handleSubmit(onPatientFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('fullName')}
                  placeholder="e.g. Vikram Joshi"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 font-medium"
                />
                {errors.fullName && (
                  <p className="text-xs text-rose-500 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (10 digits) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    {...register('mobileNumber')}
                    placeholder="9845012345"
                    className="w-full text-sm pl-12 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 font-medium"
                  />
                </div>
                {errors.mobileNumber && (
                  <p className="text-xs text-rose-500 mt-1">{errors.mobileNumber.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address (For Digital OP Slip) <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                {...register('email')}
                placeholder="vikram.joshi@example.com"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 font-medium"
              />
              {errors.email && (
                <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Demographics & Clinical Information */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                Patient Demographics & Medical Profile
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Age (Years) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={125}
                    {...register('age', { valueAsNumber: true })}
                    placeholder="e.g. 35"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-royal-500 font-bold font-mono"
                  />
                  {errors.age && (
                    <p className="text-xs text-rose-500 mt-1">{errors.age.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Date of Birth <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    {...register('dateOfBirth')}
                    onChange={(e) => {
                      const dobVal = e.target.value;
                      setValue('dateOfBirth', dobVal);
                      if (dobVal) {
                        const birth = new Date(dobVal);
                        if (!isNaN(birth.getTime())) {
                          const today = new Date();
                          let calcAge = today.getFullYear() - birth.getFullYear();
                          const m = today.getMonth() - birth.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                            calcAge--;
                          }
                          if (calcAge >= 1 && calcAge <= 125) {
                            setValue('age', calcAge, { shouldValidate: true });
                          }
                        }
                      }
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-royal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
                  <select
                    {...register('gender')}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-royal-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Blood Group</label>
                  <select
                    {...register('bloodGroup')}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-royal-500"
                  >
                    <option value="">Select (Optional)</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Residential Address</label>
                  <input
                    type="text"
                    {...register('address')}
                    placeholder="e.g. Sector 2, HSR Layout"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-royal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Emergency Contact Number</label>
                  <input
                    type="tel"
                    {...register('emergencyContact')}
                    placeholder="+91 98450 99999"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-royal-500"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Symptoms or Reason for Consultation (Optional)
                </label>
                <textarea
                  rows={2}
                  {...register('notes')}
                  placeholder="Describe any symptoms or previous medical history..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-royal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" size="md" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Slots
              </Button>
              <Button type="submit" size="md" className="bg-royal-600 hover:bg-royal-700 !text-white text-white font-bold gap-2 shadow-sm">
                <span className="text-white font-bold">Review Appointment</span> <ArrowRight className="w-4 h-4 text-white" />
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 4: REVIEW SUMMARY */}
      {step === 4 && (
        <Card className="rounded-2xl p-6 space-y-6 border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-royal-600" />
                Step 4: Review Appointment Summary
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify booking specifics before proceeding to payment
              </p>
            </div>
            <button
              onClick={() => setStep(3)}
              className="text-xs text-royal-600 font-bold hover:underline"
            >
              Edit Details
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider text-royal-600">
                Hospital & Doctor
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hospital:</span>
                  <span className="font-bold text-slate-900">{doctor.hospital?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Doctor:</span>
                  <span className="font-bold text-slate-900">{doctor.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-bold text-royal-600">{doctor.department?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-bold text-slate-900">{selectedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Time Slot:</span>
                  <span className="font-bold text-slate-900">{selectedSlot}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider text-royal-600">
                Patient Information
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Patient Name:</span>
                  <span className="font-bold text-slate-900">{getValues('fullName')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mobile:</span>
                  <span className="font-bold text-slate-900">+91 {getValues('mobileNumber')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-bold text-slate-900">{getValues('email')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Age / Gender:</span>
                  <span className="font-bold text-royal-700">
                    {getValues('age')} Yrs {getValues('gender') ? `• ${getValues('gender')}` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Blood Group:</span>
                  <span className="font-bold text-slate-900">{getValues('bloodGroup') || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Fee Breakdown</h3>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Doctor Consultation Fee:</span>
                <span className="font-bold text-slate-900">₹{doctor.consultationFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Convenience Fee:</span>
                <span className="font-bold text-slate-900">₹{platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-100 pt-2">
                <span>Total Amount Payable:</span>
                <span className="text-royal-600 text-xl font-black">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button variant="outline" size="md" onClick={() => setStep(3)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Edit
            </Button>
            <Button size="lg" onClick={() => setStep(5)} className="bg-[#FF1D6B] hover:bg-[#e1145a] !text-white text-white font-extrabold gap-2 shadow-md px-6 py-3">
              <span className="text-white font-black">Confirm & Book Appointment (₹{totalAmount})</span> <ArrowRight className="w-4 h-4 text-white" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 5: ONLINE PAYMENT */}
      {step === 5 && (
        <Card className="rounded-2xl p-6 sm:p-8 space-y-6 border-slate-200">
          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-royal-100 flex items-center justify-center text-royal-600 mx-auto mb-3">
              <CreditCard className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Complete Online Payment</h2>
            <p className="text-xs text-slate-500">
              Secured by Razorpay. Official Digital OP Slip will be generated immediately upon verified payment.
            </p>
          </div>

          {paymentError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong className="block font-bold">Payment was unsuccessful</strong>
                {paymentError}
              </div>
            </div>
          )}

          <div className="max-w-md mx-auto bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Appointment:</span>
              <span className="font-bold text-slate-900">{doctor.name}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Date & Time:</span>
              <span className="font-bold text-slate-900">{selectedDate} @ {selectedSlot}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
              <span>Total Payable:</span>
              <span className="text-royal-600 text-xl font-black">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="max-w-md mx-auto space-y-3">
            <Button
              size="lg"
              className="w-full bg-royal-600 hover:bg-royal-700 !text-white text-white font-extrabold shadow-lg py-3.5"
              isLoading={isProcessingPayment}
              onClick={handlePaymentInitiate}
            >
              <Lock className="w-5 h-5 mr-2 text-white stroke-[2.5]" />
              <span className="text-white font-black text-base">Pay ₹{totalAmount.toFixed(2)} & Complete Booking</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={isProcessingPayment}
              onClick={() => setStep(4)}
              className="w-full text-slate-500"
            >
              Return to Summary
            </Button>
          </div>

          <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            256-Bit Bank Grade SSL Encryption • Verified Idempotent Backend Processing
          </div>
        </Card>
      )}
    </div>
  );
};
