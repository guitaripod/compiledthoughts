# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm run dev` - Start development server on http://localhost:4321
- `npm run build` - Build for production (includes Pagefind search index)
- `npm run preview` - Preview production build locally

### Build CLI
- `make build` - Build the `ct` CLI tool (required for build process)
- `./ct help` - Show available CLI commands

### Testing
- `npm test` - Run all unit tests with Vitest
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:run` - Run tests once (CI mode)

### Code Quality
- `npx prettier --check "src/**/*.{js,ts,astro,css}"` - Check code formatting
- `npx prettier --write "src/**/*.{js,ts,astro,css}"` - Fix code formatting

## Architecture Overview

This is an Astro-based static blog with the following key architectural patterns:

### Content Management
- **Blog posts**: Written in MDX format in `src/content/blog/`
- **Content validation**: Zod schemas in `src/content/config.ts` define frontmatter structure
- **Required frontmatter**: `title`, `description`, `pubDate`
- **Optional frontmatter**: `updatedDate`, `image`, `tags`, `draft`, `series`

### Core Features Implementation
- **Bionic Reading**: `src/utils/bionic-reading.ts` - transforms text by bolding first 40% of words
- **Reading Time**: `src/utils/reading-time.ts` - calculates based on word count
- **Table of Contents**: `src/utils/toc.ts` - auto-generates from MDX headings
- **Related Posts**: `src/utils/related-posts.ts` - finds similar posts by tag overlap
- **Search**: Pagefind integration built during post-build process

### Component Architecture
- **Layouts**: `BaseLayout.astro` for pages, `BlogPost.astro` for posts
- **Interactive Features**: Components like `BionicToggle.astro`, `ThemeToggle.astro` use minimal client-side JS
- **Progressive Enhancement**: Features work without JavaScript, enhanced with it

### Build Process
- Static site generation with Astro
- Go-based CLI tool (`ct`) handles pre-build and post-build tasks
- Pre-build: Fetches App Store data, GitHub data, generates OG images
- Post-build: Runs Pagefind for search indexing
- Shiki for syntax highlighting with `github-dark-dimmed` theme
- Tailwind for styling with typography plugin

### Testing Strategy
- Unit tests in `tests/unit/` for utility functions
- Test aliases configured: `@utils` and `@components`
- Focus on testing pure functions: bionic reading, reading time, TOC generation, related posts

## Key Patterns

### Adding New Blog Posts
Create `.mdx` files in `src/content/blog/` with proper frontmatter schema validation.

### Feature Toggles
Most features can be toggled by removing components from layouts (e.g., removing `<BionicToggle />` disables bionic reading).

### Styling Approach
Uses Tailwind classes throughout components. Global styles in `src/styles/global.css`. Theme customization in `tailwind.config.mjs`.

## Pre-deployment Checklist

**IMPORTANT**: Before pushing code that will trigger a deployment, ALWAYS run these checks:

1. **Code Formatting**: Run `npx prettier --check "src/**/*.{js,ts,astro,css}"` to ensure all code is properly formatted. If it fails, run `npx prettier --write "src/**/*.{js,ts,astro,css}"` to fix formatting issues.

2. **Tests**: Run `npm test` to ensure all tests pass.

3. **Build**: Run `npm run build` to ensure the site builds successfully without errors.

These checks are enforced by GitHub Actions CI and will cause deployment to fail if not passing.