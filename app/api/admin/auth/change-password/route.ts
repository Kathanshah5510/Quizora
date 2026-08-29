import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChangePasswordSchema } from "@/lib/validation/admin";

const BCRYPT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  // Resolve identity exclusively from the server-side session — never trust body
  const sessionUser = await requireAdmin();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  // Fetch the current user from the DB to get the live password hash
  const dbUser = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, passwordHash: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    return NextResponse.json({ error: "Account not found or inactive" }, { status: 404 });
  }

  // Verify current password
  const currentValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!currentValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  // Guard: new password must not be identical to current
  const sameAsCurrent = await bcrypt.compare(newPassword, dbUser.passwordHash);
  if (sameAsCurrent) {
    return NextResponse.json(
      { error: "New password must be different from the current password" },
      { status: 400 }
    );
  }

  // Hash and persist
  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.user.update({
    where: { id: dbUser.id },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ success: true });
}
