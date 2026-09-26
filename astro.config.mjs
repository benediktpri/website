// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://benedikt.prisett.de",

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    sitemap({
      // Exclude pages that render with the `noindex` prop in BaseLayout.
      // Keep this list in sync with any page that sets `noindex`.
      filter: (page) =>
        !/\/(cv-mock-\d+|projects-mock-\d+|running)\/?$/.test(page),
    }),
  ],
});
