import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AVENZO",
    short_name: "AVENZO",
    description:
      "A private-first social platform for real people, posts and conversations.",
    start_url: "/",
    display: "standalone",
    background_color: "#06080a",
    theme_color: "#06080a",
    icons: [
      {
        src: "/avenzo-logo-premium.png",
        sizes: "500x500",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/avenzo-logo-premium.png",
        sizes: "500x500",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
