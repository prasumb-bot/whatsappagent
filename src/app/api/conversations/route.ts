import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const { data, error } = await supabase.rpc("get_conversations_with_last_message");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
