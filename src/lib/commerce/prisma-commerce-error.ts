import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export function commerceApiJsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ ok: false as const, error: message, code }, { status });
}

/** Maps Prisma / engine errors to a stable API response (migrate / generate hints). */
export function mapPrismaCommerceError(e: unknown): { message: string; code?: string; status: number } {
  if (
    e instanceof TypeError &&
    String(e.message).includes("Cannot read properties of undefined")
  ) {
    return {
      message:
        "Prisma istemcisi güncel değil (ticaret modelleri yüklenemedi). Tüm Node süreçlerini durdurup: npx prisma generate ve sonra npm run dev",
      code: "PRISMA_CLIENT_STALE",
      status: 503,
    };
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2021" || e.message.includes("does not exist")) {
      return {
        message:
          "Ticaret tabloları bu veritabanında yok veya eksik. Aynı DATABASE_URL ile: npx prisma migrate deploy",
        code: e.code,
        status: 503,
      };
    }
    if (e.code === "P2022") {
      return {
        message:
          "Veritabanı şeması kodla uyumsuz (kolon eksik). Çalıştırın: npx prisma migrate deploy — ardından tüm Node süreçlerini kapatıp npx prisma generate",
        code: e.code,
        status: 503,
      };
    }
    return { message: e.message, code: e.code, status: 500 };
  }
  if (e instanceof Error) return { message: e.message, status: 500 };
  return { message: "Bilinmeyen hata", status: 500 };
}
