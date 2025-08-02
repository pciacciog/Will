#!/usr/bin/env node

// ES Module server starter that works with current setup
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting WILL server with push notification support...');

// Set environment variables
process.env.NODE_ENV = 'development';

// Check APNs configuration
const apnsConfigured = !!(
  process.env.APNS_PRIVATE_KEY && 
  process.env.APNS_KEY_ID && 
  process.env.APNS_TEAM_ID &&
  process.env.APNS_TOPIC
);

console.log(`📱 APNs Push Notifications: ${apnsConfigured ? 'ENABLED' : 'SIMULATION MODE'}`);

if (apnsConfigured) {
  console.log('✅ APNS_PRIVATE_KEY: Configured');
  console.log('✅ APNS_KEY_ID: Configured'); 
  console.log('✅ APNS_TEAM_ID: Configured');
  console.log('✅ APNS_TOPIC: Configured');
} else {
  console.log('ℹ️  Running in simulation mode - notifications will be logged to console');
}

// Start the server using npx tsx
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env }
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  serverProcess.kill('SIGTERM');
});