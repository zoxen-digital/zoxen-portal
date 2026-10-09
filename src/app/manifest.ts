import type { MetadataRoute } from "next";

// Makes the portal installable as an app ("Add to Home Screen" / "Install app"), which iPhones also need for push alerts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Zoxen Digital Portal",
    short_name: "Zoxen",
    description: "Projects, approvals, invoices and updates.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B1020",
    theme_color: "#2639e8",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
