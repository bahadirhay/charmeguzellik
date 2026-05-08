import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("content.pages");
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json()) as {
    title?: string;
    slug?: string;
    published?: boolean;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli" }, { status: 400 });
  }
  const rawSlug = body.slug?.trim() ? slugify(body.slug) : slugify(title);
  if (!rawSlug) {
    return NextResponse.json({ error: "Geçerli bir slug üretin" }, { status: 400 });
  }
  if (rawSlug === "home") {
    const exists = await prisma.page.findUnique({
      where: { tenantId_slug: { tenantId: BOOTSTRAP_TENANT_ID, slug: "home" } },
    });
    if (exists) {
      return NextResponse.json({ error: "home slug tek olabilir" }, { status: 400 });
    }
  }

  const clash = await prisma.page.findUnique({
    where: { tenantId_slug: { tenantId: BOOTSTRAP_TENANT_ID, slug: rawSlug } },
  });
  if (clash) {
    return NextResponse.json({ error: "Bu slug kullanılıyor" }, { status: 409 });
  }

  const page = await prisma.page.create({
    data: {
      tenantId: BOOTSTRAP_TENANT_ID,
      slug: rawSlug,
      title,
      published: !!body.published,
      blocks: "[]",
      metaTitle: body.metaTitle?.trim() || null,
      metaDescription: body.metaDescription?.trim() || null,
    },
  });
  return NextResponse.json(page);
}
