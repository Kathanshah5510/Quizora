import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export interface AdminSessionData {
  user?: {
    id: string;
    email: string;
    name: string;
    role: "SUPER_ADMIN" | "ADMIN";
  };
}

const SESSION_OPTIONS = {
  cookieName: "quizora_admin_session",
  password: process.env.SESSION_SECRET!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 8, // 8 hours
  },
};

export async function getAdminSession(): Promise<IronSession<AdminSessionData>> {
  const cookieStore = await cookies();
  return getIronSession<AdminSessionData>(cookieStore, SESSION_OPTIONS);
}

export async function getSessionUser() {
  const session = await getAdminSession();
  return session.user ?? null;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return null;
  return user;
}

export async function requireSuperAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

export async function loginAdmin(email: string, password: string) {
  const dbUser = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!dbUser || !dbUser.isActive) return { error: "Invalid credentials" };

  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) return { error: "Invalid credentials" };

  const session = await getAdminSession();
  session.user = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as "SUPER_ADMIN" | "ADMIN",
  };
  await session.save();

  return { user: session.user };
}

export async function logoutAdmin() {
  const session = await getAdminSession();
  session.destroy();
}
