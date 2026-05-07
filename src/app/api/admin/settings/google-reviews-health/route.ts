import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { fetchGooglePlaceReviewsHealth } from "@/lib/google-place-reviews";

export async function GET() {
  const auth = await requireStaffApiPerm("site.settings");
  if (auth instanceof NextResponse) return auth;

  const health = await fetchGooglePlaceReviewsHealth({ max: 6, language: "tr" });
  return NextResponse.json(health);
}

