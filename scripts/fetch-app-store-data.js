#!/usr/bin/env node

/**
 * Fetches app data from the App Store using iTunes Search API
 * This is more reliable than scraping HTML
 */

import https from 'https';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEVELOPER_ID = '1484270247';
const APPS_DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'apps.json');

// Static metadata that enhances the App Store data
// Map by app name since bundle IDs might not be available
const APP_ENHANCEMENTS = {
  'Solar Beam': {
    id: 'solar-beam',
    tagline: 'Your Window to the Universe',
    primaryColor: '#F59E0B',
    features: [
      'Real-time space data',
      'Stunning 4K visualizations',
      'Educational astronomy content'
    ]
  },
  'SForesight': {
    id: 'sforesight',
    tagline: 'ML-Powered SF Symbol Search',
    primaryColor: '#3B82F6',
    features: [
      'ML-powered semantic search',
      'Instant symbol preview',
      'Export in multiple formats'
    ]
  },
  'Double Kick': {
    id: 'double-kick',
    tagline: 'Understand Any Menu, Anywhere',
    primaryColor: '#DC2626',
    features: [
      'Instant menu translation',
      'Dietary restriction alerts',
      'Cuisine insights'
    ]
  },
  'Psywave': {
    id: 'psywave',
    tagline: 'AI-Powered Playlist Generation',
    primaryColor: '#8B5CF6',
    features: [
      'ML-powered music analysis',
      'Mood-based playlist generation',
      'Apple Music integration'
    ]
  },
  'Dream Eater': {
    id: 'dream-eater',
    tagline: 'ML-Powered Dream Journaling',
    primaryColor: '#6366F1',
    features: [
      'Dream pattern analysis',
      'AI-powered insights',
      'Private & secure journaling'
    ]
  },
  'Master of Inventory': {
    id: 'master-of-inventory',
    tagline: 'Professional Inventory Management',
    primaryColor: '#10B981',
    features: [
      'Barcode scanning',
      'Multi-location tracking',
      'Detailed analytics'
    ]
  },
  'Master of Flags': {
    id: 'master-of-flags',
    tagline: 'Learn World Flags',
    primaryColor: '#EF4444',
    features: [
      'All country flags',
      'Interactive quizzes',
      'Progress tracking'
    ]
  }
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function mapDeviceTosPlatform(app) {
  const platforms = [];
  
  // Check supported devices array
  if (app.supportedDevices && Array.isArray(app.supportedDevices)) {
    if (app.supportedDevices.some(d => d.includes('iPhone'))) platforms.push('iPhone');
    if (app.supportedDevices.some(d => d.includes('iPad'))) platforms.push('iPad');
    if (app.supportedDevices.some(d => d.includes('iPod'))) platforms.push('iPod');
  }
  
  // Check kind for other platforms
  if (app.kind === 'mac-software') platforms.push('Mac');
  if (app.kind === 'apple-tv-software') platforms.push('Apple TV');
  
  // Default based on device families
  if (platforms.length === 0 && app.screenshotUrls) {
    if (app.ipadScreenshotUrls && app.ipadScreenshotUrls.length > 0) platforms.push('iPad');
    if (app.screenshotUrls && app.screenshotUrls.length > 0) platforms.push('iPhone');
  }
  
  return platforms.length > 0 ? platforms : ['iOS'];
}

async function fetchAppStoreData() {
  const url = `https://itunes.apple.com/lookup?id=${DEVELOPER_ID}&entity=software&limit=200&country=us`;
  
  console.log('Fetching data from iTunes Search API...');
  const data = await fetchJSON(url);
  
  if (!data.results || data.results.length === 0) {
    throw new Error('No apps found for developer');
  }
  
  // First result is developer info, rest are apps
  const apps = data.results.slice(1);
  
  return apps.map(app => {
    const appName = app.trackName;
    const enhancement = APP_ENHANCEMENTS[appName] || {};
    const urlSlug = enhancement.id || appName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    // Extract a cleaner description (first 2 sentences)
    const fullDesc = app.description || '';
    const sentences = fullDesc.split(/[.!?]+/).filter(s => s.trim());
    const cleanDesc = sentences.slice(0, 2).join('. ') + (sentences.length > 0 ? '.' : '');
    
    // Ensure App Store URL uses US location
    const appStoreUrl = app.trackViewUrl || `https://apps.apple.com/us/app/${urlSlug}/id${app.trackId}`;
    
    return {
      id: urlSlug,
      name: appName,
      tagline: enhancement.tagline || sentences[0]?.substring(0, 60) || 'Innovative app for Apple platforms',
      description: cleanDesc,
      platforms: mapDeviceTosPlatform(app),
      category: app.primaryGenreName,
      price: app.price === 0 ? 'Free' : `$${app.price}`,
      appStoreUrl: appStoreUrl.replace('https://apps.apple.com/app/', 'https://apps.apple.com/us/app/'),
      icon: app.artworkUrl512 || app.artworkUrl100,
      primaryColor: enhancement.primaryColor || '#3B82F6',
      features: enhancement.features || []
    };
  });
}

async function updateAppsData() {
  try {
    const apps = await fetchAppStoreData();
    console.log(`Found ${apps.length} apps`);
    
    // Sort apps by a predefined order
    const sortOrder = ['solar-beam', 'sforesight', 'double-kick', 'psywave', 'dream-eater', 'master-of-inventory', 'master-of-flags'];
    apps.sort((a, b) => {
      const aIndex = sortOrder.indexOf(a.id);
      const bIndex = sortOrder.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    
    const appData = { apps };
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(APPS_DATA_PATH), { recursive: true });
    
    // Write the data
    await fs.writeFile(
      APPS_DATA_PATH,
      JSON.stringify(appData, null, 2) + '\n'
    );
    
    console.log(`✓ Successfully updated ${APPS_DATA_PATH}`);
    
    // Log app names for verification
    console.log('Apps updated:');
    apps.forEach(app => console.log(`  - ${app.name} (${app.price})`));
    
  } catch (error) {
    console.error('Error fetching app data:', error.message);
    process.exit(1);
  }
}

// Run the script
updateAppsData();