export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  googleMapsApiKey: '', // Set this in environment.local.ts (not committed to git)
  googleAuthEnabled: true, // Set to true in environment.local.ts once GOOGLE_CLIENT_ID/SECRET are configured in the API
  ticketingAppUrl: 'http://localhost:4201'
};