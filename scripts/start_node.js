#!/usr/bin/env node
/**
 * Startup script for the Node.js Enhanced Trakt API Explorer
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
// Optional dependency - handle if not installed
let open = null;
try {
  open = require('open');
} catch (e) {
  // open module not available, will handle gracefully
}

function checkPackages() {
  console.log('📦 Checking Node.js packages...');
  
  if (!fs.existsSync('node_modules')) {
    console.log('❌ node_modules not found');
    console.log('Please run: npm install');
    return false;
  }
  
  try {
    require('express');
    require('cors');
    require('axios');
    require('dotenv');
    console.log('✅ All required packages are installed');
    return true;
  } catch (error) {
    console.log(`❌ Missing required package: ${error.message}`);
    console.log('Please run: npm install');
    return false;
  }
}

function checkEnvFile() {
  console.log('🔧 Checking environment configuration...');
  
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) {
    console.log('❌ .env file not found');
    console.log('Please copy .env.example to .env and add your API keys:');
    console.log('  cp .env.example .env');
    return false;
  }
  
  // Read .env file
  const envContent = fs.readFileSync(envFile, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, value] = line.split('=', 2);
      envVars[key.trim()] = value.trim();
    }
  });
  
  if (!envVars.TRAKT_API_KEY || envVars.TRAKT_API_KEY === 'your_trakt_api_key_here') {
    console.log('❌ TRAKT_API_KEY not configured in .env file');
    console.log('Please add your Trakt API key to the .env file');
    console.log('Get your API key from: https://trakt.tv/oauth/applications');
    return false;
  }
  
  console.log('✅ Environment configuration looks good');
  return true;
}

function startServer() {
  console.log('🚀 Starting Node.js server...');
  
  const serverProcess = spawn('node', ['server.js'], {
    stdio: 'pipe',
    env: { ...process.env }
  });
  
  let serverStarted = false;
  
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output.trim());
    
    if (output.includes('server running on port') && !serverStarted) {
      serverStarted = true;
      setTimeout(() => {
        openFrontend();
      }, 1000);
    }
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(data.toString().trim());
  });
  
  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
  
  return serverProcess;
}

async function openFrontend() {
  const frontendPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(frontendPath)) {
    console.log('🌐 Opening frontend in browser...');
    
    try {
      if (open) {
        await open(`file://${frontendPath}`);
        console.log(`✅ Frontend opened: file://${frontendPath}`);
      } else {
        console.log(`📱 Please open: file://${frontendPath}`);
      }
    } catch (error) {
      console.log(`📱 Please manually open: file://${frontendPath}`);
    }
    
    const port = process.env.PORT || 5000;
    console.log(`📡 Backend API: http://localhost:${port}/api`);
  } else {
    console.log('❌ index.html not found');
  }
}

function main() {
  console.log('🎬 Enhanced Trakt API Explorer - Node.js Startup');
  console.log('='.repeat(50));
  
  // Check requirements
  if (!checkPackages()) {
    process.exit(1);
  }
  
  // Check environment
  if (!checkEnvFile()) {
    process.exit(1);
  }
  
  // Start server
  const serverProcess = startServer();
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Node.js Application starting...');
  console.log('📱 Frontend: Open index.html in your browser');
  console.log('🔧 Backend: http://localhost:5000');
  console.log('🏥 Health Check: http://localhost:5000/api/health');
  console.log('\nPress Ctrl+C to stop the server');
  console.log('='.repeat(50));
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
}

if (require.main === module) {
  main();
}