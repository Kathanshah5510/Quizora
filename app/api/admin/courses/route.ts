import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { CreateCourseSchema } from "@/lib/validation/course";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courses = await db.course.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { exams: true } },
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ courses });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = CreateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { name, code, description } = parsed.data;

  const existing = await db.course.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "A course with this code already exists" }, { status: 409 });
  }

  const course = await db.course.create({
    data: {
      name: name.trim(),
      code,
      description: description?.trim() || null,
      createdById: user.id,
    },
  });

  return NextResponse.json({ course }, { status: 201 });
}
