import { supabase } from "@/lib/supabase";

interface BookingRequest {
  businessId: string;
  conversationId: string;
  patientName: string;
  patientPhone: string;
  date: string;       // "2026-04-05"
  time: string;       // "15:00"
  reason?: string;
}

interface SlotCheck {
  available: boolean;
  alternativeSlots?: string[];
}

// Check if a specific slot is open
export async function checkSlot(
  businessId: string,
  date: string,
  time: string
): Promise<SlotCheck> {
  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("business_id", businessId)
    .eq("appointment_date", date)
    .eq("appointment_time", time)
    .eq("status", "confirmed")
    .single();

  if (!existing) {
    return { available: true };
  }

  // Slot taken — find alternatives for that day
  const { data: booked } = await supabase
    .from("appointments")
    .select("appointment_time")
    .eq("business_id", businessId)
    .eq("appointment_date", date)
    .eq("status", "confirmed");

  const bookedTimes = new Set((booked || []).map((a) => a.appointment_time));

  // Generate available 30-min slots from 9am to 7pm
  const allSlots: string[] = [];
  for (let h = 9; h < 19; h++) {
    allSlots.push(`${h.toString().padStart(2, "0")}:00`);
    allSlots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  const available = allSlots.filter((s) => !bookedTimes.has(s + ":00"));

  return {
    available: false,
    alternativeSlots: available.slice(0, 5),
  };
}

// Book an appointment
export async function bookAppointment(req: BookingRequest) {
  const slot = await checkSlot(req.businessId, req.date, req.time);

  if (!slot.available) {
    return {
      success: false,
      message: `That slot is already booked. Available times: ${slot.alternativeSlots?.join(", ") || "none for this day"}`,
    };
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      business_id: req.businessId,
      conversation_id: req.conversationId,
      patient_name: req.patientName,
      patient_phone: req.patientPhone,
      appointment_date: req.date,
      appointment_time: req.time,
      reason: req.reason || null,
      status: "confirmed",
    })
    .select()
    .single();

  if (error?.code === "23505") {
    // Race condition — someone booked it between check and insert
    return {
      success: false,
      message: "That slot was just taken. Please try another time.",
    };
  }

  if (error) {
    return { success: false, message: "Booking failed. Please try again." };
  }

  return {
    success: true,
    message: `Appointment confirmed for ${req.patientName} on ${req.date} at ${req.time}.`,
    appointment: data,
  };
}

// Get all appointments for a business on a date
export async function getAppointments(businessId: string, date: string) {
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("business_id", businessId)
    .eq("appointment_date", date)
    .eq("status", "confirmed")
    .order("appointment_time", { ascending: true });

  return data || [];
}

// Cancel an appointment
export async function cancelAppointment(appointmentId: string) {
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);

  return !error;
}
