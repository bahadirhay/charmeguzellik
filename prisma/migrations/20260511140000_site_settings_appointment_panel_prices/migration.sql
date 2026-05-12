-- Randevu panelinde (admin) liste fiyatlarını gösterme tercihi
ALTER TABLE "SiteSettings" ADD COLUMN "appointmentPanelShowListPrices" BOOLEAN NOT NULL DEFAULT false;
