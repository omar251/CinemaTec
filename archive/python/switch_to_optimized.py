#!/usr/bin/env python3
"""
Script to switch between original and optimized backend versions
"""
import os
import shutil
from pathlib import Path

def backup_original():
    """Backup the original app.py"""
    if Path('app.py').exists() and not Path('app_original.py').exists():
        shutil.copy('app.py', 'app_original.py')
        print("✅ Backed up original app.py to app_original.py")

def switch_to_optimized():
    """Switch to the optimized version"""
    backup_original()
    
    if Path('app_optimized.py').exists():
        shutil.copy('app_optimized.py', 'app.py')
        print("✅ Switched to optimized backend")
        print("🚀 Restart your server to see the performance improvements!")
        print("\nNew endpoints available:")
        print("• /api/search/movies/fast - Fast search without enhancement")
        print("• /api/movies/{id}/enhance - Enhance specific movie on demand")
        print("• /api/movies/{id}/related/fast - Fast related movies")
    else:
        print("❌ app_optimized.py not found")

def switch_to_original():
    """Switch back to the original version"""
    if Path('app_original.py').exists():
        shutil.copy('app_original.py', 'app.py')
        print("✅ Switched back to original backend")
    else:
        print("❌ app_original.py not found")

def show_status():
    """Show current backend status"""
    print("📊 Backend Status:")
    print("-" * 20)
    
    if Path('app.py').exists():
        with open('app.py', 'r') as f:
            content = f.read()
            if 'ThreadPoolExecutor' in content:
                print("✅ Currently using: OPTIMIZED backend")
                print("🚀 Features: Concurrent requests, fast endpoints")
            else:
                print("📝 Currently using: ORIGINAL backend")
                print("⚠️  Performance: Sequential requests (slower)")
    
    print(f"\nFiles available:")
    for file in ['app.py', 'app_original.py', 'app_optimized.py']:
        if Path(file).exists():
            print(f"✅ {file}")
        else:
            print(f"❌ {file}")

def main():
    """Main menu"""
    print("🔧 Backend Switcher")
    print("=" * 30)
    
    show_status()
    
    print("\nOptions:")
    print("1. Switch to OPTIMIZED backend (recommended)")
    print("2. Switch to ORIGINAL backend")
    print("3. Show status only")
    print("4. Exit")
    
    choice = input("\nEnter your choice (1-4): ").strip()
    
    if choice == '1':
        switch_to_optimized()
    elif choice == '2':
        switch_to_original()
    elif choice == '3':
        show_status()
    elif choice == '4':
        print("👋 Goodbye!")
    else:
        print("❌ Invalid choice")

if __name__ == "__main__":
    main()