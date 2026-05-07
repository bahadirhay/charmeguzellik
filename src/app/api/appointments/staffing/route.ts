import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServiceStaffMap } from "@/lib/appointment-staffing";

export async function GET() {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { themeTokensJson: true },
  });
  const map = getServiceStaffMap(settings?.themeTokensJson);
  return NextResponse.json({ ok: true, map });
}

