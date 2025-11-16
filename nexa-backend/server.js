require('dotenv').config();

const app = require('./app');
const PORT = process.env.PORT || 4000;

const http = require('http');
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
