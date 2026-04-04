// Simple in-memory rate limiter
// Tracks message count per phone number within a time window

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function isRateLimited(
  phone: string,
  maxMessages: number = 5,    // max messages allowed
  windowMs: number = 60_000   // per this many milliseconds (default: 1 minute)
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);

  // No previous record — first message, allow it
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + windowMs });
    return false;
  }

  // Within window — increment and check
  entry.count += 1;

  if (entry.count > maxMessages) {
    return true; // BLOCKED
  }

  return false; // ALLOWED
}
