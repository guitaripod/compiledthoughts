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

// Modern gradient background
const bgGradient = ctx.createLinearGradient(0, 0, width, height);
bgGradient.addColorStop(0, '#1e293b');
bgGradient.addColorStop(0.5, '#0f172a');
bgGradient.addColorStop(1, '#1e1b4b');
ctx.fillStyle = bgGradient;
ctx.fillRect(0, 0, width, height);

// Add subtle noise/texture overlay
for (let i = 0; i < 3000; i++) {
  const x = Math.random() * width;
  const y = Math.random() * height;
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.02})`;
  ctx.fillRect(x, y, 1, 1);
}

// Abstract website layout representation
// Header bar
ctx.fillStyle = 'rgba(147, 51, 234, 0.15)';
ctx.fillRect(80, 80, 1040, 70);
ctx.strokeStyle = 'rgba(147, 51, 234, 0.3)';
ctx.lineWidth = 2;
ctx.strokeRect(80, 80, 1040, 70);

// Navigation dots
const navColors = ['#f59e0b', '#10b981', '#3b82f6'];
for (let i = 0; i < 3; i++) {
  ctx.fillStyle = navColors[i];
  ctx.beginPath();
  ctx.arc(950 + i * 40, 115, 8, 0, Math.PI * 2);
  ctx.fill();
}

// Logo placeholder
ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
ctx.fillRect(110, 95, 40, 40);
ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
ctx.lineWidth = 2;
ctx.strokeRect(110, 95, 40, 40);

// Main content area
// Hero section
ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
ctx.fillRect(80, 180, 500, 200);

// Text lines (abstract representation)
const textLines = [
  { x: 110, y: 220, width: 300, height: 20, color: 'rgba(248, 250, 252, 0.3)' },
  { x: 110, y: 250, width: 400, height: 16, color: 'rgba(248, 250, 252, 0.2)' },
  { x: 110, y: 275, width: 350, height: 16, color: 'rgba(248, 250, 252, 0.2)' },
  { x: 110, y: 300, width: 380, height: 16, color: 'rgba(248, 250, 252, 0.2)' },
];

textLines.forEach((line) => {
  ctx.fillStyle = line.color;
  ctx.fillRect(line.x, line.y, line.width, line.height);
});

// CTA button
ctx.fillStyle = 'rgba(147, 51, 234, 0.3)';
ctx.fillRect(110, 340, 140, 35);
ctx.strokeStyle = 'rgba(147, 51, 234, 0.5)';
ctx.lineWidth = 2;
ctx.strokeRect(110, 340, 140, 35);

// Sidebar widgets
// Widget 1 - Stats/Chart
ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
ctx.fillRect(620, 180, 240, 140);

// Chart bars
const barHeights = [60, 90, 45, 100, 75];
barHeights.forEach((height, i) => {
  ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
  ctx.fillRect(640 + i * 40, 300 - height, 30, height);
});

// Widget 2 - Cards
ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
ctx.fillRect(880, 180, 240, 140);

// Mini cards inside
for (let i = 0; i < 2; i++) {
  for (let j = 0; j < 2; j++) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.fillRect(900 + j * 110, 200 + i * 60, 90, 45);
  }
}

// Bottom section - Blog/Article cards
const cardColors = ['rgba(239, 68, 68, 0.1)', 'rgba(59, 130, 246, 0.1)', 'rgba(168, 85, 247, 0.1)'];

for (let i = 0; i < 3; i++) {
  ctx.fillStyle = cardColors[i];
  ctx.fillRect(80 + i * 380, 410, 360, 140);

  // Card content lines
  ctx.fillStyle = 'rgba(248, 250, 252, 0.2)';
  ctx.fillRect(100 + i * 380, 430, 280, 16);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.15)';
  ctx.fillRect(100 + i * 380, 455, 320, 12);
  ctx.fillRect(100 + i * 380, 475, 300, 12);
}

// Decorative elements
// Floating shapes
ctx.globalAlpha = 0.1;
// Circle
ctx.fillStyle = '#3b82f6';
ctx.beginPath();
ctx.arc(1050, 250, 60, 0, Math.PI * 2);
ctx.fill();

// Triangle
ctx.fillStyle = '#10b981';
ctx.beginPath();
ctx.moveTo(150, 480);
ctx.lineTo(190, 540);
ctx.lineTo(110, 540);
ctx.closePath();
ctx.fill();

// Square
ctx.fillStyle = '#f59e0b';
ctx.fillRect(950, 450, 80, 80);

ctx.globalAlpha = 1;

// Add subtle glow effects
const glowGradient = ctx.createRadialGradient(600, 315, 0, 600, 315, 400);
glowGradient.addColorStop(0, 'rgba(147, 51, 234, 0.1)');
glowGradient.addColorStop(1, 'rgba(147, 51, 234, 0)');
ctx.fillStyle = glowGradient;
ctx.fillRect(0, 0, width, height);

// Save the image
const outputPath = path.join(__dirname, '..', 'public', 'og-image.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log('✓ Generated og-image.png');