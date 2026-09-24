import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.avenzo.app",
  appName: "AVENZO",
  webDir: "mobile-shell",
  server: {
    url: "https://avenzo-ivory.vercel.app",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["avenzo-ivory.vercel.app"],
  },
  android: {
    backgroundColor: "#06080a",
  },
};

export default config;
