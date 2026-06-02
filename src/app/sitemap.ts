import type { MetadataRoute } from "next";

const SITE_URL = "https://abs-bridge.nine-chronicles.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
