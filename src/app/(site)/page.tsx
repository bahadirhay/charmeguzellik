import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { PublicBlocks } from "@/components/site/PublicBlocks";
import { parseBlocks } from "@/lib/blocks/schema";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const page = await prisma.page.findFirst({
    where: { slug: "home", published: true },
  });
  const settings = await getSiteSettings();
  if (!page) {
    return {
      title: settings.defaultMetaTitle ?? settings.siteName,
      description: settings.defaultMetaDescription ?? undefined,
    };
  }
  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? settings.defaultMetaDescription ?? undefined,
    openGraph: page.ogImage ? { images: [page.ogImage] } : undefined,
    robots: page.noIndex ? { index: false, follow: false } : undefined,
    alternates: page.canonicalPath ? { canonical: page.canonicalPath } : undefined,
    keywords: settings.seoKeywords?.split(",").map((k) => k.trim()),
  };
}

export default async function HomePage() {
  const page = await prisma.page.findFirst({
    where: { slug: "home", published: true },
  });
  if (!page) notFound();

  const desktop = parseBlocks(page.blocks);
  const mobileBlocks = page.blocksMobile ? parseBlocks(page.blocksMobile) : null;

  return (
    <>
      {mobileBlocks ? (
        <>
          <div className="hidden md:block">
            <PublicBlocks blocks={desktop} pageSlug="home" formRegion="page" />
          </div>
          <div className="md:hidden">
            <PublicBlocks blocks={mobileBlocks} pageSlug="home" formRegion="page" />
          </div>
        </>
      ) : (
        <PublicBlocks blocks={desktop} pageSlug="home" formRegion="page" />
      )}
    </>
  );
}
