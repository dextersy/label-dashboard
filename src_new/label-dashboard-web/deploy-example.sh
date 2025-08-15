#!/bin/bash

# Example deployment script for CI/CD environments
# This script shows how to replace API keys from environment variables during deployment

set -e

echo "🚀 Starting production build with environment variables..."

# Check if Google Maps API key is set
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo "❌ Error: GOOGLE_MAPS_API_KEY environment variable is not set"
    echo "Please set this variable in your CI/CD environment"
    exit 1
fi

# Create production environment file from template
echo "📝 Creating production environment file..."
cp src/environments/environment.prod.example.ts src/environments/environment.prod.local.ts

# Replace the placeholder with actual API key
sed -i "s/YOUR_PRODUCTION_GOOGLE_PLACES_API_KEY_HERE/$GOOGLE_MAPS_API_KEY/g" src/environments/environment.prod.local.ts

echo "✅ Environment file configured"

# Build the application
echo "🔨 Building application for production..."
npm run build:prod

echo "🎉 Build completed successfully!"
echo "📦 Built files are in: dist-prod/"

# Clean up (remove the temporary file with API key)
echo "🧹 Cleaning up temporary files..."
rm -f src/environments/environment.prod.local.ts

echo "✅ Deployment build complete!"