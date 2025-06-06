#!/usr/bin/env node

// This script can be used to generate a PNG version of the OG image if needed
// Requires: npm install sharp

console.log(`
To generate a PNG version of the OG image, you can use one of these methods:

1. Using a browser (recommended):
   - Open /public/og-image.svg in a browser
   - Right-click and save as PNG
   - Save to /public/og-image.png

2. Using an online converter:
   - Go to https://svgtopng.com/ or https://cloudconvert.com/svg-to-png
   - Upload /public/og-image.svg
   - Download and save to /public/og-image.png

3. Using command line tools:
   - Install ImageMagick: sudo apt-get install imagemagick (Linux) or brew install imagemagick (Mac)
   - Run: convert public/og-image.svg public/og-image.png

4. Using Node.js (requires additional packages):
   npm install puppeteer
   Then run a script to convert SVG to PNG

After generating the PNG, update BaseHead.astro to use '/og-image.png' instead of '/og-image.svg'
`);