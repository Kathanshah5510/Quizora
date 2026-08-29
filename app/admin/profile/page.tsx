import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account settings</p>
      </div>

      {/* Account info */}
      <div className="rounded-xl border border-border bg-card px-6 py-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Account</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium text-foreground mt-0.5">{user.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium text-foreground mt-0.5">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="font-medium text-foreground mt-0.5">
              {user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
            </p>
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="rounded-xl border border-border bg-card px-6 py-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your current session remains active after a password change.
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
