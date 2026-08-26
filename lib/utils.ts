import { v4 as uuidv4 } from "uuid";

export function parseRosterCSV(text: string): Array<{
  studentId: string;
  name: string;
  email: string;
}> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detect header by checking if first cell looks like a label, not a 9-digit ID
  const firstCell = lines[0].split(",")[0].trim().replace(/^["']|["']$/g, "");
  const isHeader = !/^\d{9}$/.test(firstCell);
  const dataLines = isHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      return {
        studentId: cols[0] ?? "",
        name: cols[1] ?? "",
        email: cols[2] ?? "",
      };
    })
    .filter((r) => r.studentId !== "");
}

export function generateExamSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = uuidv4().split("-")[0];
  return base ? `${base}-${suffix}` : suffix;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}
