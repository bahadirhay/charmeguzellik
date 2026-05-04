import { nanoid } from "nanoid";
import type { PageBlock } from "@/lib/blocks/schema";

/** Editör paleti ve önizleme için örnek klinik / kurumsal alt bilgi */
export function createMarketingFooterBlock(): PageBlock {
  return {
    id: nanoid(),
    type: "marketingFooter",
    props: {
      brandLabel: "CHERRY GÜZELLİK",
      ctas: [
        { id: nanoid(), label: "Hemen Ara", href: "tel:+905551112233", variant: "outline" },
        { id: nanoid(), label: "WhatsApp", href: "https://wa.me/905551112233", variant: "solid" },
      ],
      columns: [
        {
          id: nanoid(),
          title: "Kampanyalar sizi bekliyor",
          body:
            "Güzellik trendleri ve özel fırsatlar için bizi takip edin. Sezon kampanyaları ve paket indirimleri duyurularımızdan haberdar olun.",
        },
        {
          id: nanoid(),
          title: "Hizmetler",
          links: [
            { label: "Lazer epilasyon", href: "/hizmetler" },
            { label: "Cilt bakımı", href: "/hizmetler" },
            { label: "Bölgesel incelme", href: "/hizmetler" },
            { label: "Saç uygulamaları", href: "/hizmetler" },
          ],
        },
        {
          id: nanoid(),
          title: "Linkler",
          links: [
            { label: "Hakkımızda", href: "/hakkimizda" },
            { label: "Blog", href: "/blog" },
            { label: "İletişim", href: "/iletisim" },
          ],
        },
        {
          id: nanoid(),
          title: "Sosyal medya",
          links: [
            { label: "Instagram", href: "https://instagram.com/" },
            { label: "Facebook", href: "https://facebook.com/" },
          ],
        },
      ],
      infoCards: [
        {
          id: nanoid(),
          icon: "info",
          title: "Hakkımızda",
          lines: ["Bakırköy / İstanbul’da modern ekipman ve hijyenik ortamla hizmet veriyoruz."],
        },
        {
          id: nanoid(),
          icon: "phone",
          title: "Hemen ara",
          lines: ["+90 555 111 22 33"],
        },
        {
          id: nanoid(),
          icon: "email",
          title: "E-posta",
          lines: ["info@orneksalon.com"],
        },
        {
          id: nanoid(),
          icon: "clock",
          title: "Mesai saatlerimiz",
          lines: ["Pzt–Cmt: 09:00 – 20:00", "Pazar: kapalı"],
        },
      ],
      copyrightLine: `© ${new Date().getFullYear()} Charme Güzellik Salonu. Tüm hakları saklıdır.`,
      showFloatingWhatsapp: true,
      whatsappPhone: "905551112233",
      showBackToTop: true,
    },
  };
}
