# Google Maps API Setup

This application uses the Google Places API for venue autocomplete functionality. You need to set up your own API key to enable this feature.

## Steps to Add Your Google Maps API Key

### 1. Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Places API** (required for venue search)
   - **Maps JavaScript API** (required for map display)
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key

### 2. Secure Your API Key (Important!)

1. In the Google Cloud Console, click on your API key to edit it
2. Under "API restrictions", select "Restrict key"
3. Choose the APIs you enabled (Places API, Maps JavaScript API)
4. Under "Application restrictions", choose "HTTP referrers (web sites)"
5. Add your domain(s):
   - `localhost:4200/*` (for development)
   - `yourdomain.com/*` (for production)

### 3. Configure the Application

#### For Development:

1. Copy the example file:
   ```bash
   cp src/environments/environment.local.example.ts src/environments/environment.local.ts
   ```

2. Edit `src/environments/environment.local.ts` and replace `YOUR_GOOGLE_PLACES_API_KEY_HERE` with your actual API key:
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:3000/api',
     googleMapsApiKey: 'AIzaSyB...' // Your actual API key here
   };
   ```

3. Run the application with the local configuration:
   ```bash
   npm run start:local
   ```

#### For Production:

1. Copy the production example file:
   ```bash
   cp src/environments/environment.prod.example.ts src/environments/environment.prod.local.ts
   ```

2. Edit `src/environments/environment.prod.local.ts` and replace `YOUR_PRODUCTION_GOOGLE_PLACES_API_KEY_HERE` with your production API key:
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://beta-dashboard.melt-records.com:3001/api',
     googleMapsApiKey: 'AIzaSyB...' // Your production API key here
   };
   ```

3. Build for production:
   ```bash
   npm run build:prod
   ```

**Alternative: CI/CD with Environment Variables**
- For automated deployments, you can create a script that replaces the API key during build
- Use `sed` or similar to replace the placeholder in `environment.prod.ts` with an environment variable

## Security Notes

- ✅ `environment.local.ts` and `environment.prod.local.ts` are in `.gitignore` and won't be committed to version control
- ✅ Never commit API keys to your repository
- ✅ Always restrict your API keys in Google Cloud Console
- ✅ Monitor your API usage in Google Cloud Console

## Features Enabled by Google Maps API

- **Venue Autocomplete**: Search and select venues with automatic address population
- **Venue Details**: Automatic population of address, phone, website, and coordinates
- **Map Display**: Show venue locations in the venue location modal
- **Email Enhancement**: Venue addresses and Google Maps links in ticket emails

## New Places API Implementation

This application uses the **latest Google Maps Places API** (recommended as of March 2025) with full fallback support. The implementation includes:

### Modern APIs with Fallbacks:
- **AutocompleteSuggestion API**: Primary method for venue search (replaces deprecated AutocompleteService)
- **Place API**: Primary method for place details (replaces deprecated PlacesService)
- **Legacy API Fallbacks**: Automatic fallback to AutocompleteService and PlacesService if new APIs aren't available

### Implementation Features:
- **Dynamic Library Loading**: Uses `google.maps.importLibrary("places")` for optimal performance
- **Progressive Enhancement**: Tries new APIs first, falls back to legacy APIs seamlessly
- **Error Handling**: Robust error handling and graceful degradation
- **Future-Proof**: Follows Google's latest migration guidelines

### API Migration Status:
- ✅ **Place API**: Implemented (replaces PlacesService)
- ✅ **AutocompleteSuggestion API**: Implemented (replaces AutocompleteService)
- ✅ **Legacy Fallbacks**: Implemented for backward compatibility
- ✅ **Error Handling**: Comprehensive fallback system

For more information about the Places API migration, see: https://developers.google.com/maps/documentation/javascript/places-migration-overview

## Troubleshooting

- If autocomplete isn't working, check the browser console for API errors
- Verify your API key restrictions allow your domain
- Ensure Places API is enabled in Google Cloud Console
- Check that your API key has sufficient quota

## Cost Considerations

- Google Places API has usage-based pricing
- Autocomplete requests: ~$2.83 per 1,000 requests
- Place Details requests: ~$17.00 per 1,000 requests
- Monitor usage in Google Cloud Console to avoid unexpected costs