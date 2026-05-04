import { InstagramAdminClient } from "@/components/admin/InstagramAdminClient";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export default async function AdminInstagramPage() {
  await requirePagePermission("social.instagram");
  const [posts, settings] = await Promise.all([
    prisma.siteInstagramPost.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    getSiteSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Instagram vitrinı</h1>
        <p className="text-sm text-zinc-500">
          Gönderileri ekleyin veya Graph API ile çekin; <strong>yayında</strong> işaretleyin. Sitede
          görünmesi için ilgili sayfaya blok düzenleyicide «Instagram vitrinı» ekleyin.
        </p>
      </div>
      <InstagramAdminClient
        initialPosts={posts}
        graphUserId={settings.instagramGraphUserId ?? ""}
        graphToken={settings.instagramAccessToken ?? ""}
      />
    </div>
  );
}
