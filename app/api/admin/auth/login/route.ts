import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/auth";
import { LoginSchema } from "@/lib/validation/admin";
import { checkRateLimit } from "@/lib/exam/rateLimit";

// ─── Rate limit constants ──────────────────────────────────────────────────────
// 10 attempts per 15-minute window per IP — stops brute force while allowing
// legitimate password retries. Stricter per-email limit catches credential-
// stuffing attacks targeting a known account.
const LOGIN_MAX_PER_IP = 10;
const LOGIN_MAX_PER_EMAIL = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60; // 15 minutes

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // IP-level limit first (cheapest check before JSON parsing)
  const ipRl = checkRateLimit(`login:ip:${ip}`, LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later.", retryAfterSeconds: ipRl.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Per-email limit (prevents targeted brute force against a single account)
  const emailKey = parsed.data.email.toLowerCase().trim();
  const emailRl = checkRateLimit(`login:email:${emailKey}`, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_SECONDS);
  if (!emailRl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts for this account. Please try again later.", retryAfterSeconds: emailRl.retryAfterSeconds },
      { status: 429 }
    );
  }

  try {
    const result = await loginAdmin(parsed.data.email, parsed.data.password);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return NextResponse.json({ user: result.user });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
