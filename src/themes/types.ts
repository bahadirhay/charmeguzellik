export const THEME_IDS = ["default", "cherry"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  description: string;
  topBar: boolean;
  /** CSS dosyası yolu (globale import için referans) */
  cssPath: string;
};
