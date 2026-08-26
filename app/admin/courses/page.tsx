import { Metadata } from "next";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Courses</h1>
      <p className="text-sm text-muted-foreground">Course management — coming in Phase 2.</p>
    </div>
  );
}
