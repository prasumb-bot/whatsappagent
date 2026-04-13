import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, phone_number_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const body = await request.json();
  const { name, phone_number_id, access_token, system_prompt, webhook_verify_token } = body;

  if (!name || !phone_number_id || !access_token || !system_prompt) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      name,
      phone_number_id,
      access_token,
      system_prompt,
      webhook_verify_token: webhook_verify_token || crypto.randomUUID(),
    })
    .select("id, name, phone_number_id, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
