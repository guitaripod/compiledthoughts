#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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