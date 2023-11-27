// app.js

// Import required modules
const express = require("express");
const http = require("http");
// Create an Express application
const app = express();
const server = http.createServer(app);
const socketIo = require("socket.io");

// Create a Socket.IO instance attached to the server
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Replace with your client app's domain
    methods: ["GET", "POST"],
  },
});

const connectedID = {};

const isConnected = (id) => {
  for (const socketID in connectedID) {
    if (connectedID[socketID] == id) return true;
  }

  return false;
};

// Set up a connection event for Socket.IO
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on(
    "move",
    (
      req //req is in json format
    ) => {
      //goes to DB to find the id of camera
      const cameraID = isConnected(req.id);
      if (cameraID) {
        io.to(req.id).emit("move", req);
      } else {
        const connected = isConnected(req.id);
        io.to(socket.id).emit("error", {
          type: connected ? 500 : 400,
          message: connected ? "Camera is unavailable" : "Wrong ID",
        });
      }
    }
  );

  socket.on("test", (req) => {
    console.log(req);
  });

  // Set up a disconnect event
  socket.on("disconnect", () => {
    console.log(socket.id + " disconnected");
    delete connectedID[socket.id];
  });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
