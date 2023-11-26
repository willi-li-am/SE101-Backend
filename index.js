// app.js

// Import required modules
const express = require('express');
const http = require('http');
// Create an Express application
const app = express();
const server = http.createServer(app);
const socketIo = require("socket.io")
const multer = require('multer')
const fs = require('fs')
const axios = require('axios')


// Create a Socket.IO instance attached to the server
const io = socketIo(server, {
  cors: {
    origin: '*', // Replace with your client app's domain
    methods: ['GET', 'POST'],
  },
})

const connectedID = {};

const isConnected = (id) => {
  for (socketID in connectedID)
  {
    if (connectedID[socketID] == id)
      return true;
  }

  return false;
}

const imageToBase64 = (imagePath) => {
  // Read the image file as a buffer
  const imageBuffer = fs.readFileSync(imagePath);

  // Convert the buffer to a base64 string
  const base64Image = imageBuffer.toString('base64');

  return base64Image;
}

async function checkFire(image, io){
  axios({
    method: "POST",
    url: "https://detect.roboflow.com/wildfire_detection-slvoz/1",
    params: {
        api_key: "GeALLnJG9aiEqA6Ej9hZ"
    },
    data: image,
    headers: {
        "Content-Type": "application/x-www-form-urlencoded"
    }
}).then((response) => {
  if(response.data.predictions.length > 0)
  {
    io.emit("alert");
  }
})
}

// Set up a connection event for Socket.IO
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on("camera", (req) => {
    connectedID[socket.id] = req;
  })

  socket.on('move', (req) => //req is in json format
  {
    //goes to DB to find the id of camera
    const cameraID = isConnected(req.id);
    if (cameraID)
    {
      io.to(req.id).emit('move', req)
    }
    else
    {
      const connected = isConnected(req.id);
      io.to(socket.id).emit('error', {
        type: connected ? 500 : 400,
        message: connected ? "Camera is unavailable" : "Wrong ID"
      })
      
    }
  })

  socket.on("image", (req) =>
  {
    const date = new Date
    checkFire(req.image, io);
    io.emit("image", {
      img: req.image,
      time: date.toDateString()
    }) //base64
  })

  // Set up a disconnect event
  socket.on('disconnect', () => {
    console.log(socket.id + ' disconnected');
    delete connectedID[socket.id];
  });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
