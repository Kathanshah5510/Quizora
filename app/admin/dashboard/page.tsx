import { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getSessionUser();

  const [examCount, courseCount, userCount] = await Promise.all([
    db.exam.count(),
    db.course.count(),
    db.user.count(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Courses" value={courseCount} />
        <StatCard label="Exams" value={examCount} />
        {user?.role === "SUPER_ADMIN" && <StatCard label="Admins" value={userCount} />}
      </div>

      {/* Placeholder for recent activity */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-card-foreground mb-4">Recent Exams</h2>
        <p className="text-sm text-muted-foreground">
          No active exams. Create a course and exam to get started.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-card-foreground">{value}</p>
    </div>
  );
}
