import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js ile aynı sıra: `.env.local` üzerine yazar — CLI migrate ile dev sunucusu aynı DB’ye düşsün.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
