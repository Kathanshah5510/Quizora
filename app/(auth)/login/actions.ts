"use server";

import { redirect } from "next/navigation";
import { loginAdmin } from "@/lib/auth";
import { LoginSchema } from "@/lib/validation/admin";

export async function loginAction(_prev: unknown, formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const result = await loginAdmin(parsed.data.email, parsed.data.password);
  if (result.error) return { error: result.error };

  redirect("/admin/dashboard");
}

export async function logoutAction() {
  const { logoutAdmin } = await import("@/lib/auth");
  await logoutAdmin();
  redirect("/login");
}
