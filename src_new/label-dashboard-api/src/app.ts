import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { initializeDatabase } from './models';
import * as https from 'https';
import * as http from 'http';
import { globalRateLimit } from './middleware/rateLimiting';
import { getAllowedOrigins, csrfProtection, requireJsonContentType } from './middleware/csrf';

dotenv.config();

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

// SECURITY: Configure CORS with dynamic allowed origins from database
// This prevents unauthorized origins from making authenticated requests (CSRF protection)
const configureCors = async () => {
  const allowedOrigins = await getAllowedOrigins();
  const originsArray = Array.from(allowedOrigins);

  console.log('🔒 CORS: Configured allowed origins:', originsArray);

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS: Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies if needed in the future
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 600 // Cache preflight requests for 10 minutes
  });
};

// Middleware
app.use(helmet());
app.use(morgan('combined'));

// Apply global rate limiting to all requests
app.use(globalRateLimit);

// Increase payload limits for email with images
// 50MB limit to handle multiple large base64 images in email content
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads (legacy local uploads)
app.use('/api/uploads/artist-photos', express.static(path.join(__dirname, '../uploads/artist-photos')));

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database connection and sync models
    const isConnected = await initializeDatabase();

    if (!isConnected) {
      console.error('❌ Failed to initialize database. Exiting...');
      process.exit(1);
    }

    // SECURITY: Configure CORS with allowed origins from database
    const corsMiddleware = await configureCors();
    app.use(corsMiddleware);

    // SECURITY: Apply CSRF protection to all state-changing operations
    app.use(csrfProtection);

    // SECURITY: Require JSON content-type for POST/PUT/PATCH requests
    app.use(requireJsonContentType);

    // Import and register routes (must be done after CORS and CSRF middleware)
    const authRoutes = (await import('./routes/auth')).default;
    const userRoutes = (await import('./routes/users')).default;
    const artistRoutes = (await import('./routes/artists')).default;
    const releaseRoutes = (await import('./routes/releases')).default;
    const eventRoutes = (await import('./routes/events')).default;
    const financialRoutes = (await import('./routes/financial')).default;
    const publicRoutes = (await import('./routes/public')).default;
    const brandRoutes = (await import('./routes/brand')).default;
    const dashboardRoutes = (await import('./routes/dashboard')).default;
    const profileRoutes = (await import('./routes/profile')).default;
    const inviteRoutes = (await import('./routes/invite')).default;
    const emailRoutes = (await import('./routes/email')).default;
    const systemRoutes = (await import('./routes/system')).default;
    const songRoutes = (await import('./routes/songs')).default;
    const songwriterRoutes = (await import('./routes/songwriters')).default;

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