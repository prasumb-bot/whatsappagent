import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const { id } = await params;

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(messages);
}
