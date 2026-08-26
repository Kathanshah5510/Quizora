import { Metadata } from "next";

export const metadata: Metadata = { title: "Exams" };

export default function ExamsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Exams</h1>
      <p className="text-sm text-muted-foreground">Exam management — coming in Phase 2.</p>
    </div>
  );
}
