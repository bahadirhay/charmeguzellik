-- İptal/teyit bağlantısı: token hash ile O(1) arama (tüm tablo tarama yok)
CREATE INDEX "Appointment_cancelTokenHash_idx" ON "Appointment" ("cancelTokenHash");
