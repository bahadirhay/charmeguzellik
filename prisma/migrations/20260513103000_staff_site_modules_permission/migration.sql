-- Yönetici rolüne site.modules yetkisi (Site modülleri sayfası / tenant-features API).
UPDATE "StaffRole"
SET "permissionsJson" = left(trim("permissionsJson"), length(trim("permissionsJson")) - 1) || ',"site.modules"]'
WHERE slug = 'admin'
  AND trim("permissionsJson") NOT LIKE '%"site.modules"%'
  AND trim("permissionsJson") LIKE '[%]';
