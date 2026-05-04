import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { PublicBlocks } from "@/components/site/PublicBlocks";
import { parseBlocks } from "@/lib/blocks/schema";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "home") {
    return { title: "Yönlendiriliyor" };
  }
  const page = await prisma.page.findFirst({
    where: { slug, published: true },
  });
  const settings = await getSiteSettings();
  if (!page) {
    return { title: settings.siteName };
  }
  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? undefined,
    openGraph: page.ogImage ? { images: [page.ogImage] } : undefined,
    robots: page.noIndex ? { index: false, follow: false } : undefined,
    alternates: page.canonicalPath ? { canonical: page.canonicalPath } : undefined,
    keywords: settings.seoKeywords?.split(",").map((k) => k.trim()),
  };
}

export default async function DynamicPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "home") notFound();

  const page = await prisma.page.findFirst({
    where: { slug, published: true },
  });
  if (!page) notFound();

  const desktop = parseBlocks(page.blocks);
  const mobileBlocks = page.blocksMobile ? parseBlocks(page.blocksMobile) : null;

  return (
    <>
      {mobileBlocks ? (
        <>
          <div className="hidden md:block">
            <PublicBlocks blocks={desktop} pageSlug={slug} formRegion="page" />
          </div>
          <div className="md:hidden">
            <PublicBlocks blocks={mobileBlocks} pageSlug={slug} formRegion="page" />
          </div>
        </>
      ) : (
        <PublicBlocks blocks={desktop} pageSlug={slug} formRegion="page" />
      )}
    </>
  );
}
