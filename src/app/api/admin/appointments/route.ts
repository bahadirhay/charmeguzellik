import { NextResponse } from "next/server";
import { createAppointmentRecord, AppointmentDuplicateError } from "@/lib/create-appointment-record";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { appointmentPhoneTurkeyHint, isValidTurkeyMobileAppointmentPhone } from "@/lib/appointment-phone";

export async function GET() {
  const auth = await requireStaffApiPerm("crm.appointments");
  if (auth instanceof NextResponse) return auth;
  const list = await prisma.appointment.findMany({ orderBy: { startAt: "desc" } });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("crm.appointments");
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json()) as {
    startAt: string;
    endAt?: string | null;
    serviceName?: string | null;
    clientName: string;
    clientEmail?: string | null;
    clientPhone?: string | null;
    notes?: string | null;
  };
  if (!body.clientName?.trim() || !body.startAt) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }
  const phone = body.clientPhone?.trim() ?? "";
  if (!phone) {
    return NextResponse.json({ error: "Telefon boş bırakılamaz." }, { status: 400 });
  }
  if (!isValidTurkeyMobileAppointmentPhone(phone)) {
    return NextResponse.json({ error: appointmentPhoneTurkeyHint() }, { status: 400 });
  }
  let row;
  try {
    row = await prisma.$transaction(async (tx) =>
      createAppointmentRecord(tx, {
        startAt: new Date(body.startAt),
        endAt: body.endAt ? new Date(body.endAt) : null,
        serviceName: body.serviceName?.trim() || null,
        clientName: body.clientName,
        clientEmail: body.clientEmail?.trim() || null,
        clientPhone: phone,
        notes: body.notes?.trim() || null,
        status: "pending",
      }),
    );
  } catch (e) {
    if (e instanceof AppointmentDuplicateError) {
      return NextResponse.json(
        {
          error:
            "Aynı kişi için aynı saatte başka aktif kayıt var.",
        },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === "phone_required") {
      return NextResponse.json({ error: "Telefon boş bırakılamaz." }, { status: 400 });
    }
    throw e;
  }
  return NextResponse.json(row);
}
