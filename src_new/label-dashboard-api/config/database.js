// Load environment variables - try multiple locations quietly
try {
  require('dotenv').config();
} catch (e) {
  // Fallback - try loading from parent directory
  try {
    require('dotenv').config({ path: '../.env' });
  } catch (e2) {
    // If no .env file found, rely on system environment variables
  }
}

const config = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'meltrecords_dashboard',
  host: process.env.DB_SERVER || 'localhost',
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

module.exports = {
  development: config,
  production: config,
  test: config
};