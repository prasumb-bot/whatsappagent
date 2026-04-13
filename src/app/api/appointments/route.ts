import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const businessId = request.nextUrl.searchParams.get("business_id");
  const date = request.nextUrl.searchParams.get("date");

  if (!businessId) {
    return Response.json({ error: "business_id required" }, { status: 400 });
  }

  let query = supabase
    .from("appointments")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "confirmed")
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (date) {
    query = query.eq("appointment_date", date);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
