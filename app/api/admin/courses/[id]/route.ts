import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UpdateCourseSchema } from "@/lib/validation/course";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: {
      exams: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, availabilityStart: true, availabilityEnd: true, _count: { select: { questions: true } } },
      },
      createdBy: { select: { name: true } },
      _count: { select: { exams: true } },
    },
  });

  if (!course || course.isDeleted) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  return NextResponse.json({ course });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = UpdateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const course = await db.course.findUnique({ where: { id } });
  if (!course || course.isDeleted) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  if (parsed.data.code && parsed.data.code !== course.code) {
    const existing = await db.course.findUnique({ where: { code: parsed.data.code } });
    if (existing) {
      return NextResponse.json({ error: "A course with this code already exists" }, { status: 409 });
    }
  }

  const updated = await db.course.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
      ...(parsed.data.code !== undefined && { code: parsed.data.code }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description?.trim() || null }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  });

  return NextResponse.json({ course: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const course = await db.course.findUnique({ where: { id } });

  if (!course || course.isDeleted) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  await db.course.update({ where: { id }, data: { isDeleted: true } });
  return NextResponse.json({ success: true });
}
