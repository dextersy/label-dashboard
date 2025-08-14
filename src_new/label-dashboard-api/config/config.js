require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'meltrecords_dashboard',
    host: process.env.DB_SERVER || 'localhost',
    dialect: 'mysql',
    logging: false
  },
  production: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'meltrecords_dashboard',
    host: process.env.DB_SERVER || 'localhost',
    dialect: 'mysql',
    logging: false
  }
};