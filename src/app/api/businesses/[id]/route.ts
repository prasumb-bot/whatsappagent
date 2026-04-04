import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const { id } = await params;

  const { data, error } = await supabase
    .from("businesses")
    .select("name, phone_number_id, access_token, system_prompt, webhook_verify_token")
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "Business not found" }, { status: 404 });
  }

  return Response.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const { name, phone_number_id, access_token, system_prompt, webhook_verify_token } = body;

  if (!name || !phone_number_id || !access_token || !system_prompt) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const updateData: Record<string, string> = {
    name,
    phone_number_id,
    access_token,
    system_prompt,
  };

  if (webhook_verify_token) {
    updateData.webhook_verify_token = webhook_verify_token;
  }

  const { data, error } = await supabase
    .from("businesses")
    .update(updateData)
    .eq("id", id)
    .select("id, name, phone_number_id, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const { id } = await params;

  const { error } = await supabase
    .from("businesses")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ status: "deleted" });
}
