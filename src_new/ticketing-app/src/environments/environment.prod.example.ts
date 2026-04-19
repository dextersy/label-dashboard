// Production environment template.
// The deploy script copies this to environment.prod.ts and replaces the placeholders.
// Do NOT commit environment.prod.ts (it is gitignored).
export const environment = {
  production: true,
  apiUrl: 'https://api.spindly.app:3001/api',
  googleMapsApiKey: 'YOUR_PRODUCTION_GOOGLE_MAPS_API_KEY_HERE',
  publicListingDomain: 'YOUR_PUBLIC_LISTING_DOMAIN_HERE'
};
