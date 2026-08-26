import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign In" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/admin/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Quizora</h1>
          <p className="text-sm text-muted-foreground">Admin portal — sign in to continue</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-card-foreground">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Use your admin credentials</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
