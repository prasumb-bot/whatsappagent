import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getAIResponse } from "@/lib/ai";
import { isRateLimited } from "@/lib/rate-limiter"; // ← ADD THIS

// ... GET handler stays the same ...

async function processMessage(
  phone: string,
  text: string,
  name: string | null,
  whatsappMsgId: string
) {
  try {
    // ✅ Rate limit check — BEFORE any DB or AI calls
    if (isRateLimited(phone, 5, 60_000)) {
      console.warn(`Rate limited: ${phone}`);
      // Optionally send a polite "slow down" message (only once)
      // We don't want to spam them with rate-limit messages either
      return;
    }

    // ... rest of your processMessage stays exactly the same ...
    // Find or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("phone", phone)
      .single();

    if (!conversation) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({ phone, name })
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

    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(20);

    const aiResponse = await getAIResponse(
      (history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
    );

    const waResponse = await sendWhatsAppMessage(phone, aiResponse);

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

  if (message.type !== "text") {
    return Response.json({ status: "non_text" });
  }

  const phone = message.from;
  const text = message.text.body;
  const name = contact?.profile?.name || null;
  const whatsappMsgId = message.id;

  const { waitUntil } = await import("next/server");
  waitUntil(processMessage(phone, text, name, whatsappMsgId));

  return Response.json({ status: "received" });
}
