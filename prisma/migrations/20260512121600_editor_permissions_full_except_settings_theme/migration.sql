-- Editör rolü: site.settings ve site.theme hariç tüm panel yetkileri (canlıda ticaret vb. için).
UPDATE "StaffRole"
SET "permissionsJson" = '["content.pages","content.regions","content.nav","content.sitemap","social.instagram","social.youtube","social.tiktok","crm.leads","crm.appointments","crm.appointments.self","commerce.manage","users.manage"]'
WHERE "slug" = 'editor';
