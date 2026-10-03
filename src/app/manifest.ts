import type { MetadataRoute } from "next";

// Lets clients and the team "Add to Home Screen", which phones (iPhone especially) need for push alerts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zoxen Digital Portal",
    short_name: "Zoxen",
    description: "Projects, approvals, invoices and updates.",
    start_url: "/login",
    display: "standalone",
    background_color: "#f6f7fc",
    theme_color: "#2639e8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
