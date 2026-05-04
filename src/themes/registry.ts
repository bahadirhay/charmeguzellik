/**
 * Tema kayıtları. Yeni tema:
 * 1) `src/themes/{id}/styles.css` + `index.ts` oluşturun
 * 2) `types.ts` içindeki THEME_IDS dizisine id ekleyin
 * 3) Aşağıya import + THEMES nesnesine ekleyin
 */
import { cherryTheme } from "./cherry";
import { defaultTheme } from "./default";
import { THEME_IDS, type ThemeDefinition, type ThemeId } from "./types";

export type { ThemeDefinition, ThemeId };
export { THEME_IDS };

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  default: defaultTheme,
  cherry: cherryTheme,
};

export function normalizeThemeId(raw: string | null | undefined): ThemeId {
  if (raw === "cherry") return "cherry";
  return "default";
}

export function listThemes(): ThemeDefinition[] {
  return THEME_IDS.map((id) => THEMES[id]);
}
