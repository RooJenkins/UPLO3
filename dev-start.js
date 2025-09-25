#!/usr/bin/env node

/**
 * UPLO3 Development Server Starter
 *
 * This script helps start the development server cleanly by:
 * 1. Killing any existing conflicting processes
 * 2. Clearing caches if needed
 * 3. Starting with the correct configuration
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 UPLO3 Development Server Starter');
console.log('=====================================\n');

// Kill any existing processes
console.log('1. Cleaning up existing processes...');
try {
  execSync('pkill -f "expo\\|metro\\|rork" || true', { stdio: 'inherit' });
  console.log('   ✓ Existing processes cleaned up\n');
} catch (error) {
  console.log('   ⚠ No existing processes to clean up\n');
}

// Check if dependencies are installed
console.log('2. Checking dependencies...');
if (!fs.existsSync('node_modules')) {
  console.log('   Installing dependencies...');
  execSync('bun install', { stdio: 'inherit' });
} else {
  console.log('   ✓ Dependencies already installed\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
const isWeb = args.includes('--web');
const isTunnel = args.includes('--tunnel');
const clearCache = args.includes('--clear');

// Build start command
let command = 'bun run start-web-dev';

if (isWeb && !isTunnel) {
  command = 'npx expo start --web';
} else if (!isWeb && isTunnel) {
  command = 'bunx rork start -p 11lhbqtb21q4xicqryoig --tunnel';
} else if (!isWeb && !isTunnel) {
  command = 'npx expo start';
}

if (clearCache) {
  command += ' --clear';
}

console.log('3. Starting development server...');
console.log(`   Command: ${command}`);
console.log('   Options:');
console.log(`     Web mode: ${isWeb ? 'Yes' : 'No'}`);
console.log(`     Tunnel mode: ${isTunnel ? 'Yes' : 'No'}`);
console.log(`     Clear cache: ${clearCache ? 'Yes' : 'No'}`);
console.log();

// Start the development server
const child = spawn('sh', ['-c', command], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down development server...');
  child.kill();
  process.exit(0);
});

child.on('exit', (code) => {
  console.log(`\n\n📱 Development server exited with code ${code}`);
  process.exit(code);
});