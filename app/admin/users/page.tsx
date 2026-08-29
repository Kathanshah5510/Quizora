import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import CreateAdminForm from "./CreateAdminForm";
import DeleteAdminButton from "./DeleteAdminButton";

export const metadata: Metadata = { title: "Admins" };

export default async function UsersPage() {
  const caller = await requireSuperAdmin();
  if (!caller) redirect("/admin/dashboard");

  const admins = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage admin and super admin accounts
        </p>
      </div>

      {/* Admin list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {admins.map((admin) => (
              <tr key={admin.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{admin.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{admin.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      admin.role === "SUPER_ADMIN"
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {admin.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      admin.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {admin.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <DeleteAdminButton
                    userId={admin.id}
                    adminName={admin.name}
                    isSelf={admin.id === caller.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create admin form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-card-foreground mb-4">Create Admin</h2>
        <CreateAdminForm />
      </div>
    </div>
  );
}
