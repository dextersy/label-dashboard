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

const sslConfig = process.env.DB_SSL === 'false' ? false : {
  require: true,
  rejectUnauthorized: false,
};

const config = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'meltrecords_dashboard',
  host: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: sslConfig,
  },
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
