import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";

/** Canlı site — APK/IPA ve mağaza sürümleri her zaman burayı açar; Metro sadece JS’i yükler. */
const LIVE_SITE_ORIGIN = "https://charmeguzellik.com";
const LIVE_ADMIN_PATH = "/admin/appointments";

function isNonPublicHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  if (h.startsWith("192.168.") || h.startsWith("10.")) return true;
  if (h.startsWith("172.")) {
    const p = Number(h.split(".")[1]);
    if (p >= 16 && p <= 31) return true;
  }
  return false;
}

/**
 * Panel URL’si: yayında olan canlı domain (yerel Next’e bağlanmaz).
 * - Release: daima LIVE_SITE_ORIGIN + yol.
 * - Expo Go / __DEV__: yine varsayılan canlı; isteğe bağlı yalnızca staging için https ve kamu alan adı.
 */
function buildPanelUri(): string {
  let path = process.env.EXPO_PUBLIC_ADMIN_PATH?.trim() || LIVE_ADMIN_PATH;
  if (!path.startsWith("/")) path = `/${path}`;

  const forcedLive = `${LIVE_SITE_ORIGIN.replace(/\/$/, "")}${path}`;

  if (!__DEV__) {
    return forcedLive;
  }

  const raw = process.env.EXPO_PUBLIC_SITE_URL?.trim();
  if (!raw) return forcedLive;

  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (u.protocol !== "https:" || isNonPublicHostname(u.hostname)) return forcedLive;
    return `${u.origin.replace(/\/$/, "")}${path}`;
  } catch {
    return forcedLive;
  }
}

export default function App() {
  /** Tek sefer hesapla; canlı origin sabit, geliştirmede .env ile staging (https) seçilebilir. */
  const uri = useMemo(() => buildPanelUri(), []);
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [navTitle, setNavTitle] = useState("Randevular");

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    try {
      const u = new URL(nav.url);
      const seg = u.pathname.split("/").filter(Boolean).slice(-1)[0];
      if (seg === "login") setNavTitle("Giriş");
      else if (seg === "appointments") setNavTitle("Randevular");
      else setNavTitle("Panel");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <StatusBar style="light" />
        <View style={styles.toolbar}>
          <Text style={styles.toolbarTitle} numberOfLines={1}>
            {navTitle}
          </Text>
          <Pressable
            onPress={() => webRef.current?.reload()}
            style={({ pressed }) => [styles.reloadBtn, pressed && styles.reloadPressed]}
          >
            <Text style={styles.reloadText}>Yenile</Text>
          </Pressable>
        </View>
        <WebView
          ref={webRef}
          source={{ uri }}
          style={styles.web}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={onNavChange}
          /** Oturum çerezleri (iron-session) için */
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={Platform.OS === "android"}
          domStorageEnabled
          javaScriptEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          /** Açılışta tam ekran site; yönetim kendi içinde gezinir */
        />
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#e11d48" />
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#18181b",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#27272a",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3f3f46",
  },
  toolbarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#fafafa",
  },
  reloadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#3f3f46",
  },
  reloadPressed: {
    opacity: 0.85,
  },
  reloadText: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "500",
  },
  web: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(9,9,11,0.35)",
  },
});
