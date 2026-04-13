import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();

  if (body.mode && !["agent", "human"].includes(body.mode)) {
    return Response.json({ error: "Invalid mode" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({ mode: body.mode })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
