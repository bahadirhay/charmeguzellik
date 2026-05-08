/** DB migration ile oluşturulan varsayılan kiracı (`tenant_single_site_default` satırının `slug` değeri). */
export const DEFAULT_TENANT_SLUG = "default" as const;

/** Varsayılan kiracı birincil anahtarı — `prisma/migrations/.../tenant_foundation/migration.sql` ile eşleşmeli. */
export const DEFAULT_TENANT_ID_SEED = "tenant_single_site_default" as const;
