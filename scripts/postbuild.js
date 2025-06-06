#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Running post-build optimizations...');

// Run Pagefind
try {
  console.log('Building search index with Pagefind...');
  execSync('npx pagefind --source dist', { stdio: 'inherit' });
  console.log('✓ Search index built successfully');
} catch (error) {
  console.error('Failed to build search index:', error.message);
}

// Check if performance budget script exists
const perfBudgetScript = path.join(__dirname, 'performance-budget.js');
if (fs.existsSync(perfBudgetScript)) {
  try {
    console.log('Checking performance budget...');
    execSync(`node ${perfBudgetScript}`, { stdio: 'inherit' });
  } catch (error) {
    console.warn('Performance budget check failed:', error.message);
  }
}

console.log('✓ Post-build optimizations complete');