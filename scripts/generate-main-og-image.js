import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create canvas
const width = 1200;
const height = 630;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Dark background
ctx.fillStyle = '#0f172a';
ctx.fillRect(0, 0, width, height);

// Add gradient overlay
const gradient = ctx.createLinearGradient(0, 0, 0, height);
gradient.addColorStop(0, 'rgba(30, 41, 59, 0.8)');
gradient.addColorStop(1, 'rgba(15, 23, 42, 1)');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

// Draw grid pattern
ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
ctx.lineWidth = 1;
for (let x = 0; x < width; x += 40) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}
for (let y = 0; y < height; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

// Main content container
const containerX = 100;
const containerY = 100;
const containerWidth = 1000;
const containerHeight = 430;

// Draw title
ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
ctx.fillStyle = '#e2e8f0';
ctx.textAlign = 'center';
ctx.fillText('Compiled Thoughts', width / 2, 180);

// Draw subtitle
ctx.font = '32px system-ui, -apple-system, sans-serif';
ctx.fillStyle = '#94a3b8';
ctx.fillText('Engineer who ships across iOS, macOS, tvOS, web, and Linux', width / 2, 240);

// Draw stats boxes
const statsY = 300;
const statsSpacing = 250;
const statsStartX = (width - statsSpacing * 2) / 2;

// Stats data
const stats = [
  { number: '7', label: 'Apple Apps' },
  { number: '20+', label: 'Open Source' },
  { number: '10+', label: 'Articles' },
];

stats.forEach((stat, index) => {
  const x = statsStartX + index * statsSpacing;

  // Draw stat box
  ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  const boxWidth = 200;
  const boxHeight = 120;
  const boxX = x - boxWidth / 2;

  // Rounded rectangle
  const radius = 12;
  ctx.beginPath();
  ctx.moveTo(boxX + radius, statsY);
  ctx.lineTo(boxX + boxWidth - radius, statsY);
  ctx.quadraticCurveTo(boxX + boxWidth, statsY, boxX + boxWidth, statsY + radius);
  ctx.lineTo(boxX + boxWidth, statsY + boxHeight - radius);
  ctx.quadraticCurveTo(
    boxX + boxWidth,
    statsY + boxHeight,
    boxX + boxWidth - radius,
    statsY + boxHeight
  );
  ctx.lineTo(boxX + radius, statsY + boxHeight);
  ctx.quadraticCurveTo(boxX, statsY + boxHeight, boxX, statsY + boxHeight - radius);
  ctx.lineTo(boxX, statsY + radius);
  ctx.quadraticCurveTo(boxX, statsY, boxX + radius, statsY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw number
  ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText(stat.number, x, statsY + 55);

  // Draw label
  ctx.font = '20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(stat.label, x, statsY + 85);
});

// Add decorative elements
ctx.fillStyle = '#3b82f6';
ctx.fillRect(100, 500, 120, 4);
ctx.fillRect(980, 500, 120, 4);

// Add website URL
ctx.font = '24px system-ui, -apple-system, sans-serif';
ctx.fillStyle = '#64748b';
ctx.textAlign = 'center';
ctx.fillText('compiledthoughts.com', width / 2, 560);

// Save the image
const outputPath = path.join(__dirname, '..', 'public', 'og-image.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log('✓ Generated og-image.png');
