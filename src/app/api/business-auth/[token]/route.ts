import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 8) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("webhook_verify_token", token)
    .single();

  if (error || !business) {
    return Response.json({ error: "Business not found" }, { status: 404 });
  }

  return Response.json(business);
}
