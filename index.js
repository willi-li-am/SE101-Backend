// app.js

// Import required modules
const express = require("express");
const http = require("http");
// Create an Express application
const app = express();
const server = http.createServer(app);
const socketIo = require("socket.io");
const fs = require("fs");
const axios = require("axios");
const defaultImage = imageToBase64("./images/cow.jpg");

// Create a Socket.IO instance attached to the server
const io = socketIo(server, {
  cors: {
    origin: "*", // Replace with your client app's domain
    methods: ["GET", "POST"],
  },
});

const connectedID = {};

const isConnected = (id) => {
  for (socketID in connectedID) {
    if (connectedID[socketID] == id) return socketID;
  }

  return false;
};

var lastImage = defaultImage;
var lastTime = new Date();

//why no work

const imageToBase64 = (imagePath) => {
  // Read the image file as a buffer
  const imageBuffer = fs.readFileSync(imagePath);

  // Convert the buffer to a base64 string
  const base64Image = imageBuffer.toString("base64");

  return base64Image;
};

async function checkFire(image, io) {
  axios({
    method: "POST",
    url: "https://detect.roboflow.com/wildfire_detection-slvoz/1",
    params: {
      api_key: "GeALLnJG9aiEqA6Ej9hZ",
    },
    data: image,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  }).then((response) => {
    if (response.data.predictions.length > 0) {
      io.emit("alert");
    }
  });
}

// Set up a connection event for Socket.IO
io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("sound", (req) => {
    //once we receive the sound event,
    //we expect to be connected to a camera
    const connected = isConnected(req.id);
    if (connected === true) {
      //expecting the request to contain:
      //     audio:  - an opus encoded audio file
      io.emit("sound", {
        audio: req.audio,
      });
    }
    //TODO: add error checking :)
  });
  socket.on("join", (req) => {
    if (req.type == "client") {
      socket.join("clients");
      io.to("clients").emit("image", {
        img: lastImage,
        time: lastTime.toISOString(),
      });
    } else {
      connectedID[socket.id] = req;
      socket.join("cameras");
    }
  });

  socket.on(
    "move",
    (
      req //req is in json format
    ) => {
      //goes to DB to find the id of camera
      const cameraID = isConnected(req.id);
      if (cameraID != false) {
        io.to(cameraID).emit("move", req);
      } else {
        const connected = isConnected(req.id);
        io.to(socket.id).emit("error", {
          type: connected ? 500 : 400,
          message: connected ? "Camera is unavailable" : "Wrong ID",
        });
      }
    }
  );

  socket.on("image", (req) => {
    lastImage = req;
    const date = new Date();
    lastTime = date;
    checkFire(req, io);
    io.to("clients").emit("image", {
      img: req,
      time: date.toISOString(),
    }); //base64
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
