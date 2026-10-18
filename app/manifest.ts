import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fieldnotes Workspace",
    short_name: "Fieldnotes",
    description: "A calm, private workspace for pages and notes.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f8faf6",
    theme_color: "#406853",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
