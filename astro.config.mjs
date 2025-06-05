import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://compiledthoughts.pages.dev',
  integrations: [
    mdx({
      syntaxHighlight: 'shiki',
      shikiConfig: {
        theme: 'github-dark-dimmed',
        wrap: true,
      },
    }),
    sitemap(),
    tailwind(),
  ],
  output: 'static',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
      langs: [],
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ['@pagefind/default-ui'],
    },
  },
});