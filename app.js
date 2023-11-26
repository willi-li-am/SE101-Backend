// app.js

// Import required modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Create an Express application
const app = express();
const server = http.createServer(app);

// Create a Socket.IO instance attached to the server
const io = socketIo(server);

const connectedClients = {};

// Set up a connection event for Socket.IO
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('username', (req) =>
  {
    connectedClients[req] = socket.id;
    console.log(req + " has connected to the server");
  })

  socket.on('search', (req)=>
  {
    if(req in connectedClients)
    {
      console.log(connectedClients[req]);
    }
    else
    {
      console.log("User " + req +  " does not exist")
    }
  })

  // Set up a custom event to handle messages from clients
  socket.on('chat message', (msg) => {
    console.log('message: ' + msg);

    // Broadcast the message to all connected clients
    io.emit('chat message', msg);
  });

  // Set up a disconnect event
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
