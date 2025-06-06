#!/usr/bin/env node

/**
 * Generates an Open Graph image grid from app icons
 * Fetches icons from the App Store and creates a visually appealing grid
 */

import sharp from 'sharp';
import https from 'https';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read apps data
const appsDataPath = path.join(__dirname, '..', 'src', 'data', 'apps.json');
const appsData = JSON.parse(await fs.readFile(appsDataPath, 'utf-8'));

// Function to download image
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
  });
}

async function generateOGGrid() {
  console.log('Generating OG image grid from app icons...');
  
  try {
    // Download all app icons
    const iconPromises = appsData.apps.map(async (app) => {
      console.log(`Downloading icon for ${app.name}...`);
      const iconBuffer = await downloadImage(app.icon);
      // Resize to consistent size
      return sharp(iconBuffer)
        .resize(200, 200, { fit: 'cover' })
        .png()
        .toBuffer();
    });
    
    const icons = await Promise.all(iconPromises);
    
    // OG image dimensions
    const ogWidth = 1200;
    const ogHeight = 630;
    
    // Calculate grid layout
    const iconSize = 150;
    const padding = 30;
    const cols = 4;
    const rows = 2;
    
    // Create base image with gradient background
    const background = await sharp({
      create: {
        width: ogWidth,
        height: ogHeight,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 } // Dark background
      }
    })
    .png()
    .toBuffer();
    
    // Create gradient overlay
    const gradient = await sharp({
      create: {
        width: ogWidth,
        height: ogHeight,
        channels: 4,
        background: { r: 59, g: 130, b: 246, alpha: 0.1 } // Blue tint
      }
    })
    .png()
    .toBuffer();
    
    // Start with background
    let compositeImage = sharp(background);
    
    // Calculate starting positions to center the grid
    const totalGridWidth = (cols * iconSize) + ((cols - 1) * padding);
    const totalGridHeight = (rows * iconSize) + ((rows - 1) * padding);
    const startX = Math.floor((ogWidth - totalGridWidth) / 2);
    const startY = Math.floor((ogHeight - totalGridHeight) / 2) - 50; // Offset up for text
    
    // Prepare composite operations
    const composites = [];
    
    // Add app icons in grid
    for (let i = 0; i < Math.min(icons.length, cols * rows); i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + (col * (iconSize + padding));
      const y = startY + (row * (iconSize + padding));
      
      // Resize icon to grid size
      const resizedIcon = await sharp(icons[i])
        .resize(iconSize, iconSize)
        .composite([{
          input: Buffer.from(
            `<svg width="${iconSize}" height="${iconSize}">
              <rect width="${iconSize}" height="${iconSize}" rx="30" fill="none" stroke="white" stroke-width="2" opacity="0.2"/>
            </svg>`
          ),
          top: 0,
          left: 0
        }])
        .toBuffer();
      
      composites.push({
        input: resizedIcon,
        left: x,
        top: y
      });
    }
    
    // Add title text (using SVG)
    const titleText = Buffer.from(
      `<svg width="${ogWidth}" height="100">
        <style>
          .title { fill: white; font-size: 48px; font-weight: bold; font-family: -apple-system, system-ui, sans-serif; }
          .subtitle { fill: #94a3b8; font-size: 24px; font-family: -apple-system, system-ui, sans-serif; }
        </style>
        <text x="${ogWidth/2}" y="50" text-anchor="middle" class="title">Apple Platform Apps</text>
        <text x="${ogWidth/2}" y="85" text-anchor="middle" class="subtitle">by Marcus Ziadé</text>
      </svg>`
    );
    
    composites.push({
      input: titleText,
      top: 40,
      left: 0
    });
    
    // Add bottom text
    const bottomText = Buffer.from(
      `<svg width="${ogWidth}" height="60">
        <style>
          .stats { fill: #cbd5e1; font-size: 20px; font-family: -apple-system, system-ui, sans-serif; }
        </style>
        <text x="${ogWidth/2}" y="30" text-anchor="middle" class="stats">
          ${appsData.apps.length} Apps • iPhone • iPad • Mac • Apple TV
        </text>
      </svg>`
    );
    
    composites.push({
      input: bottomText,
      top: ogHeight - 80,
      left: 0
    });
    
    // Add a semi-transparent overlay to dim the app icons
    const overlay = await sharp({
      create: {
        width: ogWidth,
        height: ogHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.4 } // 40% black overlay
      }
    })
    .png()
    .toBuffer();
    
    // Apply icon composites first
    const withIcons = await compositeImage
      .composite(composites.filter((_, i) => i < Math.min(icons.length, cols * rows)))
      .toBuffer();
    
    // Then apply overlay and text
    const result = await sharp(withIcons)
      .composite([
        { input: overlay, top: 0, left: 0 },
        ...composites.slice(Math.min(icons.length, cols * rows))
      ])
      .png()
      .toBuffer();
    
    // Save the image
    const outputPath = path.join(__dirname, '..', 'public', 'og-apps-grid.png');
    await fs.writeFile(outputPath, result);
    
    console.log(`✓ OG grid image generated successfully at: ${outputPath}`);
    console.log(`  Dimensions: ${ogWidth}x${ogHeight}px`);
    console.log(`  Apps included: ${Math.min(icons.length, cols * rows)}`);
    
  } catch (error) {
    console.error('Error generating OG grid:', error);
    process.exit(1);
  }
}

// Check if sharp is installed
try {
  await import('sharp');
  generateOGGrid();
} catch (error) {
  console.log(`
Sharp is not installed. To generate the OG grid image, run:

npm install --save-dev sharp

Then run this script again:
node scripts/generate-apps-og-grid.js
`);
}