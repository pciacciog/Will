#!/usr/bin/env node

/**
 * Production server launcher for WILL
 * Bypasses vite dependency issues by using pre-built bundle
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIST_FILE = 'dist/index.js';
const BUILD_COMMAND = 'npx esbuild server/index-standalone.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js';

console.log('🚀 WILL Production Server Launcher');
console.log('====================================');

// Check if dist file exists and is recent
if (!fs.existsSync(DIST_FILE)) {
    console.log('📦 Building production server...');
    
    const build = spawn('sh', ['-c', BUILD_COMMAND], { stdio: 'inherit' });
    
    build.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Build successful, starting server...');
            startServer();
        } else {
            console.error('❌ Build failed with code:', code);
            process.exit(1);
        }
    });
} else {
    console.log('✅ Using existing build, starting server...');
    startServer();
}

function startServer() {
    console.log('🌐 Starting WILL server with APNs integration...');
    
    const server = spawn('node', [DIST_FILE], {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || 'production'
        }
    });
    
    server.on('close', (code) => {
        console.log(`Server exited with code: ${code}`);
        process.exit(code);
    });
    
    server.on('error', (err) => {
        console.error('Server error:', err);
        process.exit(1);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Shutting down server...');
        server.kill('SIGTERM');
    });
    
    process.on('SIGINT', () => {
        console.log('Shutting down server...');
        server.kill('SIGINT');
    });
}