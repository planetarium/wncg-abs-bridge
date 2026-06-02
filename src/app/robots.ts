import type { MetadataRoute } from "next";

const SITE_URL = "https://abs-bridge.nine-chronicles.com";

// Explicitly welcome both classic crawlers and AI-search bots so the bridge can be
// indexed by Google/Bing and cited by ChatGPT, Perplexity, Claude, and Gemini.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "PerplexityBot",
          "ChatGPT-User",
          "GPTBot",
          "OAI-SearchBot",
          "ClaudeBot",
          "anthropic-ai",
          "Claude-Web",
          "Google-Extended",
          "Applebot-Extended",
          "*",
        ],
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
