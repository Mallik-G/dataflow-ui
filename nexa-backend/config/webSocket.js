const WebSocket = (server) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: '*',
    },
    allowEIO3: true,
    pingTimeout: 1000 * 60 * 60 * 24,
    pingInterval: 1000 * 30,
  });

  io.on('connection', async (socket) => {
    console.log('new client connected', socket.id);

    socket.emit('abcdefghijklmn', Date.now());

    socket.on('join', (data) => {
      let { id } = data || {};

      if (!id) {
        return;
      }

      socket.join(id);
    });
  });

  return io;
};

module.exports = WebSocket;
