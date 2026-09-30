import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import "./avenzo-ad-theme.css";
import "./avenzo-design-system.css";
import PreferencesBootstrap from "../features/settings/components/preferences-bootstrap";
import NetworkStatus from "../components/network-status";
import AuthenticatedRuntime from "../components/authenticated-runtime";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-avenzo-ui",
});

export const metadata: Metadata = {
  applicationName: "AVENZO",
  title: {
    default: "AVENZO — Connect. Share. Belong.",
    template: "%s · AVENZO",
  },
  description:
    "AVENZO is a private-first social platform for real people, posts and conversations.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/avenzo-mark.svg", type: "image/webp" }],
    shortcut: [{ url: "/avenzo-mark.svg", type: "image/webp" }],
    apple: [{ url: "/avenzo-mark.svg", type: "image/webp" }],
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
    { media: "(prefers-color-scheme: light)", color: "#f5f8ff" },
    { media: "(prefers-color-scheme: dark)", color: "#070a12" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={manrope.variable}>
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
