const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: process.env.DB_DIALECT,
  database: process.env.DB_NAME,
  logging: false,
});

sequelize
  .authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
  })
  .catch((error) => {
    console.error('Unable to connect to the database:', error?.message);
  });

// Only sync in development mode and when explicitly requested
// if (process.env.NODE_ENV === 'development' && process.env.SYNC_DB === 'true') {
sequelize
  .sync({
    alter: true,
  })
  .then(() => {
    console.log('MODELS SYNCED (ALTER)');
  })
  .catch((err) => {
    console.log('MODEL SYNC ERROR', err?.message);
  });
// } else {
//   console.log('Database sync disabled. Use migrations for schema changes.');
// }

module.exports = {
  sq: sequelize,
};
