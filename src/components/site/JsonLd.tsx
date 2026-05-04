export type LocalBusinessJson = {
  name: string;
  description?: string;
  telephone?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  geo?: { latitude: number; longitude: number };
  url?: string;
  image?: string;
  priceRange?: string;
};

export function JsonLdLocalBusiness(data: LocalBusinessJson | null) {
  if (!data?.name) return null;
  const structured = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: data.name,
    description: data.description,
    telephone: data.telephone,
    image: data.image,
    url: data.url,
    priceRange: data.priceRange,
    address: data.address
      ? {
          "@type": "PostalAddress",
          ...data.address,
        }
      : undefined,
    geo: data.geo
      ? {
          "@type": "GeoCoordinates",
          latitude: data.geo.latitude,
          longitude: data.geo.longitude,
        }
      : undefined,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
    />
  );
}
