import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hearth — household budget",
    short_name: "Hearth",
    description: "Know what's left to spend, any day of the month.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4f0",
    theme_color: "#1f7a5a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
