#!/usr/bin/env node

// Simple Node.js script to run the TypeScript server
const { spawn } = require('child_process');
const path = require('path');

// Use the local tsx binary
const tsxPath = path.join(__dirname, 'node_modules', '.bin', 'tsx');
const serverPath = path.join(__dirname, 'server', 'index.ts');

console.log('Starting server with tsx...');
console.log('tsx path:', tsxPath);
console.log('server path:', serverPath);

// Set environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Spawn tsx process
const child = spawn(tsxPath, [serverPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  child.kill('SIGTERM');
});