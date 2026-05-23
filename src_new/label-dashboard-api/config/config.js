require('dotenv').config();

const sslConfig = process.env.DB_SSL === 'false' ? false : {
  require: true,
  rejectUnauthorized: false,
};

const baseConfig = {
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
};

// Support DATABASE_URL connection string
if (process.env.DATABASE_URL) {
  baseConfig.use_env_variable = 'DATABASE_URL';
}

module.exports = {
  development: { ...baseConfig },
  production: { ...baseConfig }
};
