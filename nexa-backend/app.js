const logger = require('morgan');
const express = require('express');
const cors = require('cors');
const app = express();
const helmet = require('helmet');

let corsOriginKeys = Object.keys(process.env).filter((key) =>
  key?.toLowerCase()?.includes('cors_origin')
);
let corsOriginValues = corsOriginKeys
  .map((key) => process.env?.[key])
  .filter((value) => !!value);

let corsOptionsDelegate = (req, cb) => {
  let corsOptions;
  if (req.header('Origin') && corsOriginValues.includes(req.header('Origin'))) {
    corsOptions = { origin: true };
  } else {
    corsOptions = { origin: false };
  }
  cb(null, corsOptions);
};
app.use(cors(corsOptionsDelegate));

app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use(helmet.hidePoweredBy());
app.use(helmet.xssFilter());
app.use(helmet.hsts());
app.use(helmet.frameguard());
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy());

require('./config/dbConfig.js');
// require('./config/aws.js');

const routes = require('./routes/index.js');
const fileRoutes = require('./routes/file.js');
app.use('/', routes);
app.use('/', fileRoutes);

app.get('/health-check', (req, res) => {
  return res.status(200).send('Server is up and running');
});

app.all('/*', function (req, res, next) {
  res.status(404).send({
    message: 'Not Found',
  });
});

module.exports = app;
