import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Thread Theory Home",
    short_name: "Thread Theory Home",
    description: "Premium bedsheets discovered on Instagram and tracked with a private order link.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6efe5",
    theme_color: "#1d2740",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
