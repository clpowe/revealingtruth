// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare(),
  site: "https://www.revealingtruth.org/",
  session: false,

  fonts: [
    {
      provider: fontProviders.google(),
      name: "Archivo",
      cssVariable: "--font-archivo",
      weights: ["100 900"],
      styles: ["normal"],
      fallbacks: ["Helvetica Neue", "Arial", "sans-serif"],
      options: {
        experimental: {
          // Width axis powers `font-stretch` in .font-display
          variableAxis: { wdth: [["62", "125"]] },
        },
      },
    },
    {
      provider: fontProviders.google(),
      name: "Instrument Serif",
      cssVariable: "--font-instrument-serif",
      weights: [400],
      styles: ["normal", "italic"],
      fallbacks: ["Times New Roman", "serif"],
    },
    {
      provider: fontProviders.google(),
      name: "DM Sans",
      cssVariable: "--font-dm-sans",
      weights: ["400 700"],
      styles: ["normal"],
      fallbacks: ["system-ui", "sans-serif"],
    },
  ],

  integrations: [
    sitemap({
      filter: (page) => !page.includes("/components") && !page.includes("/prayer/thank-you"),
    }),
  ],

  security: {
    checkOrigin: true,
    actionBodySizeLimit: 16 * 1024,
  },
});

