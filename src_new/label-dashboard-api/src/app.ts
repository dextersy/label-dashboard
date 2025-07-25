import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { initializeDatabase } from './models';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// API Routes (protected)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/dashboard', dashboardRoutes);

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

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📖 API Endpoints:`);
      console.log(`   Health Check: GET http://localhost:${PORT}/api/health`);
      console.log(`   DB Test: GET http://localhost:${PORT}/api/db-test`);
      console.log(`\n🔐 Authentication:`);
      console.log(`   Login: POST http://localhost:${PORT}/api/auth/login`);
      console.log(`   Logout: POST http://localhost:${PORT}/api/auth/logout`);
      console.log(`   Current User: GET http://localhost:${PORT}/api/auth/me`);
      console.log(`\n👥 User Management:`);
      console.log(`   Check Username: POST http://localhost:${PORT}/api/users/check-username`);
      console.log(`   Send Reset Link: POST http://localhost:${PORT}/api/users/send-reset-link`);
      console.log(`   Initialize User: POST http://localhost:${PORT}/api/users/init`);
      console.log(`\n🎤 Artist Management:`);
      console.log(`   Get Artists: GET http://localhost:${PORT}/api/artists`);
      console.log(`   Create Artist: POST http://localhost:${PORT}/api/artists`);
      console.log(`   Update Artist: PUT http://localhost:${PORT}/api/artists/:id`);
      console.log(`\n💿 Release Management:`);
      console.log(`   Get Releases: GET http://localhost:${PORT}/api/releases`);
      console.log(`   Create Release: POST http://localhost:${PORT}/api/releases`);
      console.log(`\n🎫 Event & Tickets:`);
      console.log(`   Get Events: GET http://localhost:${PORT}/api/events`);
      console.log(`   Create Event: POST http://localhost:${PORT}/api/events`);
      console.log(`   Add Ticket: POST http://localhost:${PORT}/api/events/tickets`);
      console.log(`\n💰 Financial:`);
      console.log(`   Add Earning: POST http://localhost:${PORT}/api/financial/earnings`);
      console.log(`   Add Payment: POST http://localhost:${PORT}/api/financial/payments`);
      console.log(`   Financial Summary: GET http://localhost:${PORT}/api/financial/summary`);
      console.log(`\n🏢 Brand Settings:`);
      console.log(`   Get Brand by Domain: GET http://localhost:${PORT}/api/brands/by-domain`);
      console.log(`   Get Brand Settings: GET http://localhost:${PORT}/api/brands/:brandId`);
      console.log(`\n🌐 Public API:`);
      console.log(`   Buy Ticket: POST http://localhost:${PORT}/api/public/tickets/buy`);
      console.log(`   Verify Ticket: POST http://localhost:${PORT}/api/public/tickets/verify`);
      console.log(`   Payment Webhook: POST http://localhost:${PORT}/api/public/webhook/payment`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;