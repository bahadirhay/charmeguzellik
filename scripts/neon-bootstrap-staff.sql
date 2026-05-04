-- Neon SQL Editor: panel rolleri + admin kullanıcı (şifre aşağıda değiştirin).
-- bcrypt: pgcrypto `crypt(..., gen_salt('bf', 12))` — uygulamadaki bcryptjs ile uyumludur.
-- Yetkiniz yoksa: CREATE EXTENSION satırını atlayıp yerelde `npm run reset:admin` kullanın.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Varsayılan roller (slug çakışırsa güncellenir)
INSERT INTO "StaffRole" ("id", "slug", "label", "permissionsJson")
SELECT gen_random_uuid()::text, v.slug, v.label, v.perms
FROM (
  VALUES
    (
      'admin',
      'Yönetici',
      '["site.settings","site.theme","content.pages","content.regions","content.nav","content.sitemap","social.instagram","social.youtube","social.tiktok","crm.leads","crm.appointments","users.manage"]'::text
    ),
    (
      'editor',
      'Editör',
      '["content.pages","content.regions","content.nav"]'::text
    ),
    (
      'scheduler',
      'Randevu operatörü',
      '["crm.appointments"]'::text
    )
) AS v(slug, label, perms)
ON CONFLICT ("slug") DO UPDATE SET
  "label" = EXCLUDED."label",
  "permissionsJson" = EXCLUDED."permissionsJson";

-- Admin kullanıcı: 'BurayaSifreniz' → kendi şifreniz (en az 6 karakter); tek tırnak içinde ' için '' yazın.
INSERT INTO "StaffUser" ("id", "username", "passwordHash", "displayName", "roleId", "active")
SELECT
  gen_random_uuid()::text,
  'admin',
  crypt('BurayaSifreniz', gen_salt('bf', 12)),
  'Yönetici',
  r."id",
  true
FROM "StaffRole" r
WHERE r."slug" = 'admin'
ON CONFLICT ("username") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "roleId" = EXCLUDED."roleId",
  "active" = true,
  "displayName" = COALESCE("StaffUser"."displayName", EXCLUDED."displayName");
