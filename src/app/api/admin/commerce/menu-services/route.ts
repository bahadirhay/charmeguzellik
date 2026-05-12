import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { collectServiceLabelsFromNav, getPublishedNavTree } from "@/lib/navigation";

/** Liste fiyatı / paket / prim: randevu formu ile aynı kaynak — üst menü «Hizmetlerimiz» altındaki yayınlı başlıklar */
export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const nodes = await getPublishedNavTree("header");
  const labels = collectServiceLabelsFromNav(nodes);
  return NextResponse.json({ ok: true, labels });
}
