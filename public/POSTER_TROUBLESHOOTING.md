# 🖼️ Poster Troubleshooting Guide

## 🔧 **Fixes Applied**

### **1. Backend Enhancement**
- ✅ **Updated `/movies/:traktId/full` endpoint** to use enhancement service
- ✅ **Added poster data** from TMDB API integration
- ✅ **Enhanced movie data structure** with poster URLs

### **2. Frontend Poster Detection**
- ✅ **Multiple poster source fallbacks**:
  1. `details.poster_url` (from enhancement service)
  2. `details.images?.poster?.medium` (Trakt API)
  3. `details.images?.poster?.full` (Trakt API)
  4. `details.poster_path` (direct TMDB path)
  5. `details.tmdb_data?.poster_path` (TMDB data object)

### **3. Visual Improvements**
- ✅ **Poster placeholder** when no poster available
- ✅ **Error logging** for failed poster loads
- ✅ **Graceful fallback** with styled placeholder

## 🔍 **How to Check if Posters are Working**

### **1. Check Browser Console**
- Open Developer Tools (F12)
- Look for poster-related logs
- Check for any error messages about poster loading

### **2. Check Backend Configuration**
- Verify TMDB API key is configured in `.env`:
  ```
  TMDB_API_KEY=your_api_key_here
  ```

### **3. Test API Endpoints**
- Test full movie details: `GET /api/movies/{traktId}/full`
- Should include `poster_url` field in response

## 🛠️ **Backend Configuration Check**

### **Required Environment Variables:**
```bash
# In your .env file
TMDB_API_KEY=your_tmdb_api_key_here
```

### **TMDB API Key Setup:**
1. Go to https://www.themoviedb.org/
2. Create an account
3. Go to Settings → API
4. Request an API key
5. Add to your `.env` file

## 🔧 **Debugging Steps**

### **1. Check Server Logs**
Look for these messages in server console:
- ✅ `TMDB service initialized` (good)
- ⚠️ `TMDB API key not configured` (needs setup)

### **2. Test Movie Details API**
```bash
# Test if poster data is included
curl http://localhost:3000/api/movies/1390/full
```

Should return data with `poster_url` field.

### **3. Browser Network Tab**
- Open Network tab in DevTools
- Click on a movie node
- Check if poster image requests are being made
- Look for 404 or other errors

## 🎨 **Visual Indicators**

### **Poster Loading States:**
- **✅ Success**: High-quality movie poster displays
- **⚠️ Loading**: Placeholder shows while loading
- **❌ Failed**: "No Poster Available" placeholder with film icon

### **Console Logging:**
- Poster load failures are logged to console
- Includes the attempted poster URL for debugging

## 🔧 **Common Issues & Solutions**

### **Issue 1: No TMDB API Key**
**Symptoms**: All movies show "No Poster Available"
**Solution**: Add TMDB API key to `.env` file and restart server

### **Issue 2: CORS Issues**
**Symptoms**: Poster URLs work in new tab but not in app
**Solution**: Already handled - using backend proxy

### **Issue 3: Rate Limiting**
**Symptoms**: Some posters load, others don't
**Solution**: Backend includes caching to prevent rate limits

### **Issue 4: Wrong Poster URLs**
**Symptoms**: 404 errors in network tab
**Solution**: Multiple fallback sources implemented

## 📊 **Expected Behavior**

### **With TMDB API Key:**
- ✅ High-quality movie posters from TMDB
- ✅ Fast loading with caching
- ✅ Automatic fallbacks for missing posters

### **Without TMDB API Key:**
- ⚠️ "No Poster Available" placeholder
- ✅ All other functionality works normally
- ⚠️ Server log shows TMDB not configured

## 🚀 **Testing Instructions**

### **1. Quick Test:**
1. Click any movie node
2. Movie details modal should open
3. Check if poster appears or placeholder shows

### **2. Full Test:**
1. Add TMDB API key to `.env`
2. Restart server
3. Clear browser cache
4. Test multiple movies
5. Check browser console for errors

### **3. API Test:**
```bash
# Test the enhanced endpoint
curl http://localhost:3000/api/movies/1390/full | grep poster_url
```

## 🎯 **Result**

Posters should now work with:
- 🖼️ **High-quality images** from TMDB
- 🔄 **Multiple fallback sources** for reliability
- 🎨 **Professional placeholders** when unavailable
- 🔧 **Easy debugging** with console logging
- ⚡ **Fast loading** with backend caching

**If posters still don't appear, check the TMDB API key configuration first!**