import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AVENZO",
    short_name: "AVENZO",
    description:
      "A private-first social platform for real people, posts and conversations.",
    start_url: "/",
    display: "standalone",
    background_color: "#101113",
    theme_color: "#101113",
    icons: [
      {
        src: "/avenzo-logo-premium.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/avenzo-logo-maskable.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
