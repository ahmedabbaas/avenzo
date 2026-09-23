import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    icon: "/avenzo-mark.svg",
    shortcut: "/avenzo-mark.svg",
    apple: "/avenzo-mark.svg",
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
  colorScheme: "dark",
  themeColor: "#06080a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
