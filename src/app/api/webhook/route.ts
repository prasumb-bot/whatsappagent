import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getAIResponse } from "@/lib/ai";

// ─── Webhook Verification (unchanged) ───
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// ─── The actual heavy lifting (runs AFTER 200 is sent) ───
async function processMessage(
  phone: string,
  text: string,
  name: string | null,
  whatsappMsgId: string
) {
  try {
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

    // Store user message (ignore duplicates)
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: text,
      whatsapp_msg_id: whatsappMsgId,
    });

    if (insertError?.code === "23505") {
      // Duplicate message — already processed
      return;
    }

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

    // If human mode, just store — don't auto-reply
    if (conversation.mode === "human") {
      return;
    }

    // Fetch conversation history
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Get AI response
    const aiResponse = await getAIResponse(
      (history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
    );

    // Send via WhatsApp
    const waResponse = await sendWhatsAppMessage(phone, aiResponse);

    // Check if WhatsApp send actually worked
    if (waResponse?.error) {
      console.error("WhatsApp send failed:", waResponse.error);
      return;
    }

    // Store AI reply
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: aiResponse,
    });

    // Update timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

  } catch (error) {
    console.error("Background processing error:", error);
  }
}

// ─── Webhook Handler (returns 200 INSTANTLY) ───
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Ignore non-WhatsApp events
  if (body.object !== "whatsapp_business_account") {
    return Response.json({ status: "ignored" });
  }

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // Ignore status updates (delivered, read receipts, etc.)
  if (!value?.messages?.[0]) {
    return Response.json({ status: "no_message" });
  }

  const message = value.messages[0];
  const contact = value.contacts?.[0];

  // Only handle text for now
  if (message.type !== "text") {
    return Response.json({ status: "non_text" });
  }

  const phone = message.from;
  const text = message.text.body;
  const name = contact?.profile?.name || null;
  const whatsappMsgId = message.id;

  // ✅ THE KEY LINE — fire background task, don't await it
  // waitUntil keeps the serverless function alive after response is sent
  const { waitUntil } = await import("next/server");
  waitUntil(processMessage(phone, text, name, whatsappMsgId));

  // ✅ Return 200 to Meta IMMEDIATELY (< 100ms)
  return Response.json({ status: "received" });
}
