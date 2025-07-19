#!/usr/bin/env python3
"""
Performance comparison script between original and optimized backends
"""
import time
import requests
import json

def test_endpoint(url, description):
    """Test an endpoint and measure response time."""
    print(f"\n🧪 Testing: {description}")
    print(f"URL: {url}")
    
    start_time = time.time()
    try:
        response = requests.get(url, timeout=30)
        end_time = time.time()
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success: {end_time - start_time:.2f}s")
            print(f"📊 Results: {len(data) if isinstance(data, list) else 1} items")
            return end_time - start_time
        else:
            print(f"❌ Error: {response.status_code}")
            return None
            
    except requests.exceptions.Timeout:
        print(f"⏰ Timeout after 30 seconds")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def main():
    """Run performance comparison tests."""
    print("🚀 Performance Comparison: Original vs Optimized Backend")
    print("=" * 60)
    
    base_url = "http://localhost:5000/api"
    test_query = "batman"
    
    # Test search endpoints
    print("\n📋 SEARCH PERFORMANCE")
    print("-" * 30)
    
    original_time = test_endpoint(
        f"{base_url}/search/movies?query={test_query}",
        "Original Search (with enhancement)"
    )
    
    fast_time = test_endpoint(
        f"{base_url}/search/movies/fast?query={test_query}",
        "Fast Search (basic data only)"
    )
    
    # Test related movies (need a movie ID first)
    print("\n📋 RELATED MOVIES PERFORMANCE")
    print("-" * 30)
    
    # Get a movie ID first
    try:
        response = requests.get(f"{base_url}/search/movies/fast?query={test_query}")
        if response.status_code == 200:
            movies = response.json()
            if movies:
                movie_id = movies[0]['movie']['ids']['trakt']
                print(f"Using movie ID: {movie_id}")
                
                related_time = test_endpoint(
                    f"{base_url}/movies/{movie_id}/related",
                    "Related Movies (with enhancement)"
                )
                
                related_fast_time = test_endpoint(
                    f"{base_url}/movies/{movie_id}/related/fast",
                    "Related Movies (basic data only)"
                )
                
                # Performance summary
                print("\n📊 PERFORMANCE SUMMARY")
                print("=" * 40)
                
                if original_time and fast_time:
                    improvement = ((original_time - fast_time) / original_time) * 100
                    print(f"Search Speed Improvement: {improvement:.1f}%")
                    print(f"Original: {original_time:.2f}s → Fast: {fast_time:.2f}s")
                
                if related_time and related_fast_time:
                    improvement = ((related_time - related_fast_time) / related_time) * 100
                    print(f"Related Movies Speed Improvement: {improvement:.1f}%")
                    print(f"Original: {related_time:.2f}s → Fast: {related_fast_time:.2f}s")
                
    except Exception as e:
        print(f"❌ Could not test related movies: {e}")
    
    print("\n💡 RECOMMENDATIONS")
    print("-" * 20)
    print("• Use /fast endpoints for initial loading")
    print("• Enhance data on-demand when user selects a movie")
    print("• Consider caching frequently accessed data")
    print("• Implement pagination for large result sets")

if __name__ == "__main__":
    main()