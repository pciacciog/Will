#!/usr/bin/env node

// Simple Node.js wrapper to start the TypeScript server
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

try {
  console.log('Starting WILL server...');
  console.log('Environment:', process.env.NODE_ENV);
  
  // Check if APNs credentials are configured
  const apnsConfigured = !!(
    process.env.APNS_PRIVATE_KEY && 
    process.env.APNS_KEY_ID && 
    process.env.APNS_TEAM_ID
  );
  
  console.log('APNs Push Notifications:', apnsConfigured ? 'ENABLED' : 'SIMULATION MODE');
  
  // Start the TypeScript server
  const serverPath = path.join(__dirname, 'index.ts');
  execSync(`npx tsx "${serverPath}"`, { 
    stdio: 'inherit',
    cwd: path.dirname(__dirname)
  });
} catch (error) {
  console.error('Failed to start server:', error.message);
  process.exit(1);
}