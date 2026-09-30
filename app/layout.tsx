import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./avenzo-ad-theme.css";
import "./avenzo-design-system.css";
import PreferencesBootstrap from "../features/settings/components/preferences-bootstrap";
import NetworkStatus from "../components/network-status";
import AuthenticatedRuntime from "../components/authenticated-runtime";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-avenzo-ui",
});

export const metadata: Metadata = {
  applicationName: "AVENZO",
  title: {
    default: "AVENZO â€” Connect. Share. Belong.",
    template: "%s Â· AVENZO",
  },
  description:
    "AVENZO is a private-first social platform for real people, posts and conversations.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/avenzo-logo-premium.png", type: "image/png" }],
    shortcut: [{ url: "/avenzo-logo-premium.png", type: "image/png" }],
    apple: [{ url: "/avenzo-logo-premium.png", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#050607" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={jakarta.variable}>
        <PreferencesBootstrap />
        <AuthenticatedRuntime />
        <NetworkStatus />
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
