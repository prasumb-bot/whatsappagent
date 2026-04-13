import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getAIResponse } from "@/lib/ai";
import { isRateLimited } from "@/lib/rate-limiter";
import type { Business } from "@/lib/types";

// ─── Webhook Verification ───
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token) {
    return new Response("Forbidden", { status: 403 });
  }

  // Check token against any business
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("webhook_verify_token", token)
    .single();

  // Also check env fallback for backward compat
  if (business || token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// ─── Background Processing ───
async function processMessage(
  phone: string,
  text: string,
  name: string | null,
  whatsappMsgId: string,
  phoneNumberId: string
) {
  try {
    if (isRateLimited(phone, 5, 60_000)) {
      console.warn(`Rate limited: ${phone}`);
      return;
    }

    // Find the business by the phone_number_id that received this message
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("phone_number_id", phoneNumberId)
      .single();

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("phone", phone)
      .eq(
        "business_id",
        business?.id || "00000000-0000-0000-0000-000000000000"
      )
      .single();

    if (!conversation) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({
          phone,
          name,
          business_id: business?.id || null,
        })
        .select()
        .single();
      conversation = newConvo;
    } else if (name && name !== conversation.name) {
      await supabase
        .from("conversations")
        .update({ name })
        .eq("id", conversation.id);
    }

    if (!conversation) {
      console.error("Failed to create conversation for", phone);
      return;
    }

    // Store user message
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: text,
      whatsapp_msg_id: whatsappMsgId,
    });

    if (insertError?.code === "23505") {
      return;
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

    if (conversation.mode === "human") {
      return;
    }

    // Fetch history
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(20);

    // AI response with business-specific system prompt
    const aiResponse = await getAIResponse(
      (history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      (business as Business)?.system_prompt,
      {
        businessId: business?.id,
        conversationId: conversation.id,
        patientPhone: phone,
      }
    );

    // Send via that business's WhatsApp credentials
    const waResponse = await sendWhatsAppMessage(
      phone,
      aiResponse,
      (business as Business)?.phone_number_id,
      (business as Business)?.access_token
    );

    if (waResponse?.error) {
      console.error("WhatsApp send failed:", waResponse.error);
      return;
    }

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: aiResponse,
    });

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
  } catch (error) {
    console.error("Background processing error:", error);
  }
}

// ─── Webhook Handler (returns 200 instantly) ───
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.object !== "whatsapp_business_account") {
    return Response.json({ status: "ignored" });
  }

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.[0]) {
    return Response.json({ status: "no_message" });
  }

  const message = value.messages[0];
  const contact = value.contacts?.[0];

  // Handle non-text messages gracefully
  if (message.type !== "text") {
    const phone = message.from;
    const phoneNumberId = value.metadata?.phone_number_id || "";

    // Look up business for credentials
    const { data: business } = await supabase
      .from("businesses")
      .select("phone_number_id, access_token")
      .eq("phone_number_id", phoneNumberId)
      .single();

    await sendWhatsAppMessage(
      phone,
      "I can only read text messages right now. Could you type out what you'd like to share? 🙏",
      business?.phone_number_id,
      business?.access_token
    );

    return Response.json({ status: "non_text_handled" });
  }

  const phone = message.from;
  const text = message.text.body;
  const name = contact?.profile?.name || null;
  const whatsappMsgId = message.id;
  const phoneNumberId = value.metadata?.phone_number_id || "";

  const { waitUntil } = await import("next/server");
  waitUntil(processMessage(phone, text, name, whatsappMsgId, phoneNumberId));

  return Response.json({ status: "received" });
}
