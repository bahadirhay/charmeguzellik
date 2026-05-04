import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await prisma.lead.create({
    data: {
      name: body.name.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      message: body.message?.trim() || null,
      source: "contact_form",
    },
  });
  return NextResponse.json({ ok: true });
}
