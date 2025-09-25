const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolver to handle Node.js modules that don't exist in React Native
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['native', 'ios', 'android', 'web'];

// Create empty module path for Node.js modules
const emptyModulePath = path.resolve(__dirname, 'empty-module.js');

// Replace problematic Node.js modules and undici with empty modules
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  // Node.js built-in modules
  'node:sqlite': emptyModulePath,
  'node:fs': emptyModulePath,
  'node:path': emptyModulePath,
  'node:os': emptyModulePath,
  'node:util': emptyModulePath,
  'node:crypto': emptyModulePath,
  'node:stream': emptyModulePath,
  'node:buffer': emptyModulePath,
  'node:events': emptyModulePath,
  // Exclude undici entirely to prevent sqlite issues
  'undici': emptyModulePath,
};

// Block problematic modules at the resolver level
config.resolver.blacklistRE = [
  /node_modules\/undici\/lib\/cache\/sqlite-cache-store\.js$/,
  /.*\/node:sqlite$/,
];

// Add support for API routes and better error handling
config.resolver.sourceExts.push('ts', 'tsx');

module.exports = config;