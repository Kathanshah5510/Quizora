import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "./LoginForm";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "Sign In" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/admin/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Mesh gradient background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 10%, oklch(0.51 0.22 264 / 0.18) 0%, transparent 60%), " +
            "radial-gradient(ellipse 60% 50% at 80% 80%, oklch(0.55 0.22 295 / 0.16) 0%, transparent 60%), " +
            "radial-gradient(ellipse 70% 70% at 50% 50%, oklch(0.62 0.18 320 / 0.08) 0%, transparent 70%)",
        }}
      />

      {/* Animated blobs */}
      <div
        className="blob1 absolute -top-32 -left-32 h-96 w-96 rounded-full -z-10 opacity-30"
        style={{ background: "oklch(0.51 0.22 264 / 0.35)", filter: "blur(80px)" }}
      />
      <div
        className="blob2 absolute -bottom-32 -right-16 h-80 w-80 rounded-full -z-10 opacity-20"
        style={{ background: "oklch(0.55 0.22 295 / 0.4)", filter: "blur(70px)" }}
      />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl font-black text-xl text-white"
              style={{
                background: "linear-gradient(135deg, oklch(0.55 0.25 264), oklch(0.60 0.22 295))",
                boxShadow: "0 4px 24px oklch(0.51 0.22 264 / 0.5)",
              }}
            >
              Q
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight grad-text">Quizora</h1>
            <p className="text-sm text-muted-foreground mt-1">Admin portal — sign in to continue</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 space-y-6"
          style={{
            background: "var(--card)",
            border: "1px solid oklch(0.51 0.22 264 / 0.15)",
            boxShadow: "0 8px 40px oklch(0.51 0.22 264 / 0.12), 0 2px 8px oklch(0 0 0 / 0.08)",
          }}
        >
          <div>
            <h2 className="text-xl font-bold text-card-foreground">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Use your admin credentials</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
