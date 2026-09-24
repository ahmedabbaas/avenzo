import type { Metadata, Viewport } from "next";
import "./globals.css";
import PreferencesBootstrap from "../features/settings/components/preferences-bootstrap";

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
    icon: [{ url: "/avenzo-logo.webp", type: "image/webp" }],
    shortcut: [{ url: "/avenzo-logo.webp", type: "image/webp" }],
    apple: [{ url: "/avenzo-logo.webp", type: "image/webp" }],
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
    { media: "(prefers-color-scheme: light)", color: "#f5f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#06080a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PreferencesBootstrap />
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
