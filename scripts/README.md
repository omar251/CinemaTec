# Scripts Directory

This directory contains utility scripts for the Trakt API Explorer.

## Available Scripts

### Core Scripts
- **`start_node.js`** - Smart startup script with environment checks
- **`network_generator.js`** - Generate movie network visualizations

### Testing Scripts
- **`test_migration.js`** - Test Node.js migration functionality
- **`test_ai_integration.js`** - Test AI features integration
- **`test_gemini_api.js`** - Test Gemini AI API connectivity
- **`performance_test.js`** - Performance benchmarking

## Usage

```bash
# Quick start with checks
npm run quick-start

# Generate movie networks
npm run generate-network

# Run tests
npm test
npm run test-migration
npm run test-ai
```

## Script Descriptions

### start_node.js
Comprehensive startup script that:
- Checks Node.js dependencies
- Validates environment configuration
- Starts the server with proper error handling
- Opens the frontend automatically

### network_generator.js
Advanced movie network generator that:
- Creates interactive D3.js visualizations
- Builds movie relationship graphs
- Exports networks in multiple formats
- Supports batch generation

### Testing Scripts
All testing scripts validate different aspects of the application:
- API endpoint functionality
- Performance metrics
- AI integration features
- Migration completeness