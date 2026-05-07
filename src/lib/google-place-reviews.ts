import type { TestimonialItem } from "@/components/site/TestimonialCarousel";

type GooglePlaceDetailsResponse = {
  status?: string;
  result?: {
    reviews?: Array<{
      author_name?: string;
      profile_photo_url?: string;
      relative_time_description?: string;
      rating?: number;
      text?: string;
      time?: number;
    }>;
  };
  error_message?: string;
};

export type GooglePlaceReviewsHealth = {
  ok: boolean;
  configured: boolean;
  message: string;
  totalFromGoogle: number;
  publishedAfterFilter: number;
};

/**
 * Google Places yorumlarını sunucu tarafında çeker.
 * ENV eksik veya API hatasında null döner; çağıran taraf manuel yorumlara düşmelidir.
 */
export async function fetchGooglePlaceReviews(opts?: {
  max?: number;
  language?: string;
}): Promise<TestimonialItem[] | null> {
  const h = await fetchGooglePlaceReviewsHealth(opts);
  return h.ok && h.reviews?.length ? h.reviews : null;
}

export async function fetchGooglePlaceReviewsHealth(
  opts?: {
    max?: number;
    language?: string;
  },
): Promise<GooglePlaceReviewsHealth & { reviews?: TestimonialItem[] }> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const placeId = process.env.GOOGLE_PLACE_ID?.trim();
  if (!key || !placeId) {
    return {
      ok: false,
      configured: false,
      message: "GOOGLE_PLACES_API_KEY veya GOOGLE_PLACE_ID eksik.",
      totalFromGoogle: 0,
      publishedAfterFilter: 0,
    };
  }

  const max = Math.min(10, Math.max(1, opts?.max ?? 6));
  const language = opts?.language?.trim() || "tr";
  const minRating = Math.min(5, Math.max(1, parseInt(process.env.GOOGLE_REVIEWS_MIN_RATING ?? "4", 10) || 4));
  const blockTerms = (process.env.GOOGLE_REVIEWS_BLOCK_TERMS ?? "")
    .split(",")
    .map((s) => s.trim().toLocaleLowerCase("tr-TR"))
    .filter(Boolean);

  const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  u.searchParams.set("place_id", placeId);
  u.searchParams.set("fields", "reviews");
  u.searchParams.set("language", language);
  u.searchParams.set("reviews_sort", "newest");
  u.searchParams.set("key", key);

  let data: GooglePlaceDetailsResponse | null = null;
  try {
    const res = await fetch(u.toString(), {
      method: "GET",
      next: { revalidate: 60 * 60 * 6 }, // 6 saat cache
    });
    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        message: `Google API HTTP ${res.status}`,
        totalFromGoogle: 0,
        publishedAfterFilter: 0,
      };
    }
    data = (await res.json()) as GooglePlaceDetailsResponse;
  } catch {
    return {
      ok: false,
      configured: true,
      message: "Google API bağlantısı başarısız.",
      totalFromGoogle: 0,
      publishedAfterFilter: 0,
    };
  }

  if (!data || data.status !== "OK") {
    return {
      ok: false,
      configured: true,
      message: data?.error_message?.trim() || `Google API status: ${data?.status ?? "unknown"}`,
      totalFromGoogle: 0,
      publishedAfterFilter: 0,
    };
  }

  const reviews = Array.isArray(data.result?.reviews) ? data.result!.reviews! : [];
  const mapped = reviews
    .filter((r) => Boolean(r?.author_name?.trim()) && Boolean(r?.text?.trim()))
    .filter((r) => (typeof r.rating === "number" ? r.rating >= minRating : true))
    .filter((r) => {
      if (!blockTerms.length) return true;
      const txt = (r.text ?? "").toLocaleLowerCase("tr-TR");
      return !blockTerms.some((t) => txt.includes(t));
    })
    .slice(0, max)
    .map((r, idx): TestimonialItem => {
      const name = r.author_name!.trim();
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join("");
      return {
        id: `google-${idx}-${r.time ?? Date.now()}`,
        name,
        relativeTimeLabel: r.relative_time_description?.trim() || undefined,
        rating: typeof r.rating === "number" ? Math.max(1, Math.min(5, Math.round(r.rating))) : 5,
        text: r.text!.trim(),
        sourceLabel: "Google",
        avatarUrl: r.profile_photo_url?.trim() || undefined,
        initials,
      };
    });

  if (mapped.length === 0) {
    return {
      ok: false,
      configured: true,
      message: `Yorumlar çekildi ancak filtre sonrası yayınlanacak kayıt yok (min puan: ${minRating}).`,
      totalFromGoogle: reviews.length,
      publishedAfterFilter: 0,
      reviews: [],
    };
  }

  return {
    ok: true,
    configured: true,
    message: `Google yorumları aktif. Filtre: min puan ${minRating}${blockTerms.length ? `, engelli kelime: ${blockTerms.length}` : ""}.`,
    totalFromGoogle: reviews.length,
    publishedAfterFilter: mapped.length,
    reviews: mapped,
  };
}

