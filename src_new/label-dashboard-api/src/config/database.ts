import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelizeOptions: any = {
  database: process.env.DB_DATABASE || 'meltrecords_dashboard',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: process.env.DB_SSL === 'false' ? false : {
      require: true,
      rejectUnauthorized: false,
    },
  },
};

// Support DATABASE_URL connection string (Supabase provides this)
export const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      pool: sequelizeOptions.pool,
      dialectOptions: sequelizeOptions.dialectOptions,
    })
  : new Sequelize(sequelizeOptions);

export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};
