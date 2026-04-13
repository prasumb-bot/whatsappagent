export interface Business {
  id: string;
  name: string;
  phone_number_id: string;
  access_token: string;
  system_prompt: string;
  webhook_verify_token: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  phone: string;
  name: string | null;
  mode: "agent" | "human";
  business_id: string | null;
  updated_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  whatsapp_msg_id: string | null;
  created_at: string;
}

export interface ConversationWithLastMessage extends Conversation {
  last_message: string | null;
}

export interface Appointment {
  id: string;
  business_id: string;
  conversation_id: string | null;
  patient_name: string;
  patient_phone: string;
  appointment_date: string;
  appointment_time: string;
  reason: string | null;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  notes: string | null;
  created_at: string;
}
