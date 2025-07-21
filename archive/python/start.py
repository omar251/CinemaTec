#!/usr/bin/env python3
"""
Startup script for the CinemaTec Movie Network Explorer
"""
import os
import sys
import subprocess
import webbrowser
import time
from pathlib import Path

def check_requirements():
    """Check if required packages are installed."""
    try:
        import flask
        import flask_cors
        import requests
        print("✅ All required packages are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing required package: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def check_env_file():
    """Check if .env file exists and has required variables."""
    env_file = Path('.env')
    if not env_file.exists():
        print("❌ .env file not found")
        print("Please copy .env.example to .env and add your API keys:")
        print("  cp .env.example .env")
        return False
    
    # Read .env file
    env_vars = {}
    with open('.env', 'r') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                env_vars[key] = value
    
    if not env_vars.get('TRAKT_API_KEY') or env_vars.get('TRAKT_API_KEY') == 'your_trakt_api_key_here':
        print("❌ TRAKT_API_KEY not configured in .env file")
        print("Please add your Trakt API key to the .env file")
        print("Get your API key from: https://trakt.tv/oauth/applications")
        return False
    
    print("✅ Environment configuration looks good")
    return True

def load_env_file():
    """Load environment variables from .env file."""
    env_file = Path('.env')
    if env_file.exists():
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value

def start_backend():
    """Start the Flask backend server."""
    print("🚀 Starting backend server...")
    load_env_file()
    
    # Import and run the Flask app
    try:
        from app import app
        port = int(os.getenv('PORT', 5000))
        
        # Start the server in a separate process
        import threading
        def run_server():
            app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
        
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        
        # Wait a moment for server to start
        time.sleep(2)
        print(f"✅ Backend server running on http://localhost:{port}")
        return port
        
    except Exception as e:
        print(f"❌ Failed to start backend: {e}")
        return None

def open_frontend(backend_port):
    """Open the frontend in the default browser."""
    frontend_path = Path('index.html').absolute()
    if frontend_path.exists():
        print("🌐 Opening frontend in browser...")
        webbrowser.open(f'file://{frontend_path}')
        print(f"✅ Frontend opened: file://{frontend_path}")
        print(f"📡 Backend API: http://localhost:{backend_port}/api")
    else:
        print("❌ index.html not found")

def main():
    """Main startup function."""
    print("🎬 CinemaTec Movie Network Explorer - Startup Script")
    print("=" * 50)
    
    # Check requirements
    if not check_requirements():
        sys.exit(1)
    
    # Check environment
    if not check_env_file():
        sys.exit(1)
    
    # Start backend
    backend_port = start_backend()
    if not backend_port:
        sys.exit(1)
    
    # Open frontend
    open_frontend(backend_port)
    
    print("\n" + "=" * 50)
    print("🎉 Application started successfully!")
    print(f"📱 Frontend: Open index.html in your browser")
    print(f"🔧 Backend: http://localhost:{backend_port}")
    print(f"🏥 Health Check: http://localhost:{backend_port}/api/health")
    print("\nPress Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        # Keep the script running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
        sys.exit(0)

if __name__ == "__main__":
    main()