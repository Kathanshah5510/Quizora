"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { CreateAdminSchema } from "@/lib/validation/admin";

type CreateAdminState = { error: string; success: boolean };

export async function createAdminAction(_prev: CreateAdminState, formData: FormData): Promise<CreateAdminState> {
  const caller = await requireSuperAdmin();
  if (!caller) return { error: "Unauthorized", success: false };

  const raw = {
    email: formData.get("email") as string,
    name: formData.get("name") as string,
    password: formData.get("password") as string,
    role: (formData.get("role") as string) || "ADMIN",
  };

  const parsed = CreateAdminSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "An account with this email already exists", success: false };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.user.create({
    data: {
      email: parsed.data.email.toLowerCase().trim(),
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role as "ADMIN" | "SUPER_ADMIN",
    },
  });

  revalidatePath("/admin/users");
  return { error: "", success: true };
}

export async function toggleAdminActiveAction(userId: string, isActive: boolean) {
  const caller = await requireSuperAdmin();
  if (!caller) return { error: "Unauthorized" };
  if (userId === caller.id) return { error: "Cannot deactivate your own account" };

  await db.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath("/admin/users");
  return { success: true };
}
