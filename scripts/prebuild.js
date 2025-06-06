#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('Running pre-build tasks...');

// Fetch latest app store data
try {
  console.log('Fetching latest App Store data...');
  execSync('node scripts/fetch-app-store-data.js', { stdio: 'inherit' });
  console.log('✓ App Store data updated successfully');
} catch (error) {
  console.error('Failed to fetch App Store data:', error.message);
  // Don't fail the build if App Store fetch fails
}

// Fetch latest GitHub data
try {
  console.log('Fetching latest GitHub repository data...');
  execSync('node scripts/fetch-github-data.js', { stdio: 'inherit' });
  console.log('✓ GitHub data updated successfully');
} catch (error) {
  console.error('Failed to fetch GitHub data:', error.message);
  // Don't fail the build if GitHub fetch fails
}

// Generate OG image
try {
  console.log('Generating OG image...');
  execSync('node scripts/generate-main-og-image.js', { stdio: 'inherit' });
  console.log('✓ OG image generated successfully');
} catch (error) {
  console.error('Failed to generate OG image:', error.message);
  // Don't fail the build if OG image generation fails
}

console.log('✓ Pre-build tasks complete');
