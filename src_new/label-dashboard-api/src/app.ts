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

dotenv.config();

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// Apply global rate limiting to all requests
app.use(globalRateLimit);

// Increase payload limits for email with images
// 50MB limit to handle multiple large base64 images in email content
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads (legacy local uploads)
app.use('/api/uploads/artist-photos', express.static(path.join(__dirname, '../uploads/artist-photos')));


// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import artistRoutes from './routes/artists';
import releaseRoutes from './routes/releases';
import eventRoutes from './routes/events';
import financialRoutes from './routes/financial';
import publicRoutes from './routes/public';
import brandRoutes from './routes/brand';
import dashboardRoutes from './routes/dashboard';
import profileRoutes from './routes/profile';
import inviteRoutes from './routes/invite';
import emailRoutes from './routes/email';

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

// Public API Routes (no authentication required)
app.use('/api/public', publicRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Label Dashboard API is running' });
});

// Database connection test
app.get('/api/db-test', async (req, res) => {
  try {
    const isConnected = await initializeDatabase();
    if (isConnected) {
      res.json({ status: 'OK', message: 'Database connection and models synchronized successfully' });
    } else {
      res.status(500).json({ status: 'ERROR', message: 'Database connection failed' });
    }
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Database connection failed', error: error.message });
  }
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database connection and sync models
    const isConnected = await initializeDatabase();
    
    if (!isConnected) {
      console.error('❌ Failed to initialize database. Exiting...');
      process.exit(1);
    }

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
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;