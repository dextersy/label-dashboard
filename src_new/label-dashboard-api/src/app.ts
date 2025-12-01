import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { initializeDatabase } from './models';
import * as https from 'https';
import * as http from 'http';
import { globalRateLimit } from './middleware/rateLimiting';
import {
  getAllowedOrigins,
  getAllowedOriginsSync,
  preWarmCache,
  startBackgroundRefresh,
  csrfProtection,
  requireJsonContentType
} from './middleware/csrf';

dotenv.config();

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

// SECURITY: Configure CORS with dynamic allowed origins from database
// This prevents unauthorized origins from making authenticated requests (CSRF protection)
// PERFORMANCE: Uses synchronous cache access (pre-warmed on startup, refreshed in background)
const configureCors = () => {
  return cors({
    origin: async (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // PERFORMANCE: Try synchronous cache access first (avoids async overhead on preflight requests)
      let allowedOrigins = getAllowedOriginsSync();

      // Fallback to async fetch if cache is not available (should never happen after pre-warming)
      if (!allowedOrigins) {
        console.warn('⚠️  CORS: Cache not available, falling back to async fetch');
        allowedOrigins = await getAllowedOrigins();
      }

      // Normalize to lowercase for case-insensitive comparison (DNS is case-insensitive)
      if (allowedOrigins.has(origin.toLowerCase())) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS: Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies if needed in the future
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'X-Request-Id', 'Content-Disposition'],
    maxAge: 600 // Cache preflight requests for 10 minutes
  });
};

// Middleware
app.use(helmet());
app.use(morgan('combined'));

// NOTE: Global rate limiting is applied AFTER CORS middleware inside startServer()
// This ensures 429 responses include CORS headers so browsers can read them

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database connection and sync models
    const isConnected = await initializeDatabase();

    if (!isConnected) {
      console.error('❌ Failed to initialize database. Exiting...');
      process.exit(1);
    }

    // PERFORMANCE: Pre-warm origins cache on startup to prevent blocking preflight requests
    await preWarmCache();

    // PERFORMANCE: Start background refresh to keep cache warm (prevents cache misses)
    startBackgroundRefresh();

    // SECURITY: Configure CORS with dynamic allowed origins from database
    // Origins are checked synchronously using pre-warmed cache (no DB queries on preflight)
    const corsMiddleware = configureCors();
    app.use(corsMiddleware);
    console.log('🔒 CORS: Configured with pre-warmed cache and background refresh');

    // SECURITY: Apply global rate limiting AFTER CORS so 429 responses include CORS headers
    // This allows the browser to properly read rate limit errors instead of treating them as network errors
    app.use(globalRateLimit);
    console.log('🔒 Rate limiting: Applied after CORS middleware');

    // SECURITY: Apply CSRF protection to all state-changing operations
    app.use(csrfProtection);

    // SECURITY: Require JSON content-type for POST/PUT/PATCH requests
    app.use(requireJsonContentType);

    // SECURITY: Static file serving after CORS - only accessible from whitelisted origins
    // Legacy local uploads (being migrated to S3)
    app.use('/api/uploads/artist-photos', express.static(path.join(__dirname, '../uploads/artist-photos')));

    // SECURITY: Body parsers applied AFTER CORS/CSRF to prevent resource exhaustion attacks
    // Malicious requests are rejected before parsing large payloads (up to 50mb)
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    app.use(cookieParser());
    console.log('🔒 Body parsers: Configured after security middleware');

    // Import and register routes (must be done after CORS and CSRF middleware)
    console.log('📦 Loading route modules...');

    const routeModules = [
      { name: 'auth', path: './routes/auth' },
      { name: 'users', path: './routes/users' },
      { name: 'artists', path: './routes/artists' },
      { name: 'releases', path: './routes/releases' },
      { name: 'events', path: './routes/events' },
      { name: 'financial', path: './routes/financial' },
      { name: 'public', path: './routes/public' },
      { name: 'brand', path: './routes/brand' },
      { name: 'dashboard', path: './routes/dashboard' },
      { name: 'profile', path: './routes/profile' },
      { name: 'invite', path: './routes/invite' },
      { name: 'email', path: './routes/email' },
      { name: 'system', path: './routes/system' },
      { name: 'songs', path: './routes/songs' },
      { name: 'songwriters', path: './routes/songwriters' }
    ];

    // Load all route modules in parallel with detailed error reporting
    const routeResults = await Promise.allSettled(
      routeModules.map(async (module) => {
        try {
          const imported = await import(module.path);
          return { name: module.name, router: imported.default };
        } catch (error) {
          console.error(`❌ Failed to load route module '${module.name}' from '${module.path}':`, error);
          throw new Error(`Route module '${module.name}' failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      })
    );

    // Check for any failed imports
    const failedImports = routeResults.filter(result => result.status === 'rejected');
    if (failedImports.length > 0) {
      console.error(`❌ Failed to load ${failedImports.length} route module(s):`);
      failedImports.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`   - ${routeModules[routeResults.indexOf(result)].name}: ${result.reason}`);
        }
      });
      throw new Error(`Failed to load ${failedImports.length} route module(s). Check logs above for details.`);
    }

    // Extract successfully loaded routes
    const routes = routeResults
      .filter((result): result is PromiseFulfilledResult<{ name: string; router: any }> => result.status === 'fulfilled')
      .reduce((acc, result) => {
        acc[result.value.name] = result.value.router;
        return acc;
      }, {} as Record<string, any>);

    const authRoutes = routes.auth;
    const userRoutes = routes.users;
    const artistRoutes = routes.artists;
    const releaseRoutes = routes.releases;
    const eventRoutes = routes.events;
    const financialRoutes = routes.financial;
    const publicRoutes = routes.public;
    const brandRoutes = routes.brand;
    const dashboardRoutes = routes.dashboard;
    const profileRoutes = routes.profile;
    const inviteRoutes = routes.invite;
    const emailRoutes = routes.email;
    const systemRoutes = routes.system;
    const songRoutes = routes.songs;
    const songwriterRoutes = routes.songwriters;

    console.log(`✅ Successfully loaded ${routeResults.length} route modules`);

    // API Routes (protected)
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/artists', artistRoutes);
    app.use('/api/releases', releaseRoutes);
    app.use('/api/events', eventRoutes);
    app.use('/api/financial', financialRoutes);
    app.use('/api/brands', brandRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/profile', profileRoutes);
    app.use('/api/invite', inviteRoutes);
    app.use('/api/email', emailRoutes);
    app.use('/api/songs', songRoutes);
    app.use('/api/songwriters', songwriterRoutes);

    // Public API Routes (no authentication required)
    app.use('/api/public', publicRoutes);

    // System API Routes (system user authentication required)
    app.use('/api/system', systemRoutes);

    // Health check and test routes (registered after CORS)
    app.get('/api/health', (req, res) => {
      res.json({ status: 'OK', message: 'Label Dashboard API is running' });
    });

    app.get('/api/db-test', async (req, res) => {
      try {
        const isConnected = await initializeDatabase();
        if (isConnected) {
          res.json({ status: 'OK', message: 'Database connection and models synchronized successfully' });
        } else {
          res.status(500).json({ status: 'ERROR', message: 'Database connection failed' });
        }
      } catch (error: any) {
        res.status(500).json({ status: 'ERROR', message: 'Database connection failed', error: error.message });
      }
    });

    // Create server
    var server, port;
    if (process.env.HTTPS_KEY_FILE && process.env.HTTPS_CERT_FILE) {
      console.log("🔒 Key & certificate found. Using HTTPS..");
      const httpsOptions = {
          key: fs.readFileSync(process.env.HTTPS_KEY_FILE),
          cert: fs.readFileSync(process.env.HTTPS_CERT_FILE)
      }
      server = https.createServer(httpsOptions, app);
      port = HTTPS_PORT;
    } else {
      console.log("🔓 No key & certificate. Using HTTP..");
      server = http.createServer(app);
      port = HTTP_PORT;
    }

    // Start server
    server.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
      console.log(`📖 API Endpoints:`);
      console.log(`   Health Check: GET http://localhost:${port}/api/health`);
      console.log(`   DB Test: GET http://localhost:${port}/api/db-test`);
      console.log(`\n🔐 Authentication:`);
      console.log(`   Login: POST http://localhost:${port}/api/auth/login`);
      console.log(`   Logout: POST http://localhost:${port}/api/auth/logout`);
      console.log(`   Current User: GET http://localhost:${port}/api/auth/me`);
      console.log(`\n👥 User Management:`);
      console.log(`   Check Username: POST http://localhost:${port}/api/users/check-username`);
      console.log(`   Send Reset Link: POST http://localhost:${port}/api/users/send-reset-link`);
      console.log(`   Initialize User: POST http://localhost:${port}/api/users/init`);
      console.log(`\n🎤 Artist Management:`);
      console.log(`   Get Artists: GET http://localhost:${port}/api/artists`);
      console.log(`   Create Artist: POST http://localhost:${port}/api/artists`);
      console.log(`   Update Artist: PUT http://localhost:${port}/api/artists/:id`);
      console.log(`\n💿 Release Management:`);
      console.log(`   Get Releases: GET http://localhost:${port}/api/releases`);
      console.log(`   Create Release: POST http://localhost:${port}/api/releases`);
      console.log(`\n🎫 Event & Tickets:`);
      console.log(`   Get Events: GET http://localhost:${port}/api/events`);
      console.log(`   Create Event: POST http://localhost:${port}/api/events`);
      console.log(`   Add Ticket: POST http://localhost:${port}/api/events/tickets`);
      console.log(`\n💰 Financial:`);
      console.log(`   Add Earning: POST http://localhost:${port}/api/financial/earnings`);
      console.log(`   Add Payment: POST http://localhost:${port}/api/financial/payments`);
      console.log(`   Financial Summary: GET http://localhost:${port}/api/financial/summary`);
      console.log(`\n🏢 Brand Settings:`);
      console.log(`   Get Brand by Domain: GET http://localhost:${port}/api/brands/by-domain`);
      console.log(`   Get Brand Settings: GET http://localhost:${port}/api/brands/:brandId`);
      console.log(`\n🌐 Public API:`);
      console.log(`   Buy Ticket: POST http://localhost:${port}/api/public/tickets/buy`);
      console.log(`   Verify Ticket: POST http://localhost:${port}/api/public/tickets/verify`);
      console.log(`   Payment Webhook: POST http://localhost:${port}/api/public/webhook/payment`);
      console.log(`\n🔧 System API (System Users Only - Cross-Brand Access):`);
      console.log(`   System Login: POST http://localhost:${port}/api/system/auth/login`);
      console.log(`   System Auth Check: GET http://localhost:${port}/api/system/auth/me`);
      console.log(`   Artists Due Payment (All Brands): GET http://localhost:${port}/api/system/artists-due-payment`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;