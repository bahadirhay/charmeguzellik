import type { ThemeDefinition } from "../types";

export const defaultTheme: ThemeDefinition = {
  id: "default",
  label: "Varsayılan (minimal)",
  description: "Nötr rose/zinc düzen, tek satır logo + menü.",
  topBar: false,
  cssPath: "@/themes/default/styles.css",
};
