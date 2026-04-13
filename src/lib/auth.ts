import { NextRequest } from "next/server";

// Simple token-based auth for MVP
// Later replace with Supabase Auth or NextAuth
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN;

export function isAuthenticated(request: NextRequest): boolean {
  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${DASHBOARD_TOKEN}`) {
    return true;
  }

  // Check query param (for browser/simple access)
  const token = request.nextUrl.searchParams.get("token");
  if (token === DASHBOARD_TOKEN) {
    return true;
  }

  return false;
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
