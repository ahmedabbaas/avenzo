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
        src: "/avenzo-logo.webp",
        sizes: "2048x2048",
        type: "image/webp",
        purpose: "any",
      },
      {
        src: "/avenzo-logo.webp",
        sizes: "2048x2048",
        type: "image/webp",
        purpose: "maskable",
      },
    ],
  };
}
