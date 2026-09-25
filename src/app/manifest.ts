import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hearth — household budget",
    short_name: "Hearth",
    description: "Know what's left to spend, any day of the month.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ee",
    theme_color: "#17150f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
