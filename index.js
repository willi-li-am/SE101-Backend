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

// Create a Socket.IO instance attached to the server
const io = socketIo(server, {
  cors: {
    origin: "*", // Replace with your client app's domain
    methods: ["GET", "POST"],
  },
});

const connectedID = {};

const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.1.google.com:19302", "stun:stun2.1.google.com:19302"],
    },
  ],
};

const isConnected = (id) => {
  for (socketID in connectedID) {
    if (connectedID[socketID] == id) return socketID;
  }

  return false;
};

//why no work
const imageToBase64 = (imagePath) => {
  // Read the image file as a buffer
  const imageBuffer = fs.readFileSync(imagePath);

  // Convert the buffer to a base64 string
  const base64Image = imageBuffer.toString("base64");

  return base64Image;
};

var lastImage = imageToBase64("./images/cow.jpg");
var lastTime = new Date();
var lastLastImage = lastImage;

async function checkFire(image, io) {
  try {
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
  } catch (err) {
    console.log("fuck roboflow");
  }
}
let peerConnection = null;

setInterval(() => {
  console.log("Checked fire");
  if (lastLastImage == lastImage) {
    lastLastImage = lastImage;
    checkFire(lastImage, io);
  }
}, 10000);

// Set up a connection event for Socket.IO
io.on("connection", (socket) => {
  console.log("A user connected");
  /*Web RTC 
  -> Server expects to be the only peer connected to the raspberry pi.
  PI initites connection by sending an offer message and the server responds with an answer
  Web rtc takes care of the rest
  */
  socket.on("message", async (message) => {
    if (message.type == "offer") {
      console.log("Received an offer!");
      peerConnection = new RTCPeerConnection(configuration);
      let offer = message.offer;
      await peerConnection.setRemoteDescription(offer);

      let answer = await peerConnection.createAnswer();

      await peerConnection.setLocalDescription(answer);
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.send({ type: "candidate", candidate: event.candidate });
        }
      };
      peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          io.to("clients").emit("track", { track: track });
        });
      };
      io.to("cameras").emit("answer", {
        answer: peerConnection.localDescription,
      });
    }
  });

  socket.on("sound", (req) => {
    //once we receive the sound event,
    //we expect to be connected to a camera

    //expecting the request to contain:
    //     audio:  - an array of bytes representing the audio
    console.log(req.audio);
    io.emit("sound", {
      audio: req.audio,
    });
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
    console.log("received image");
    lastLastImage = lastImage;
    lastImage = req;
    const date = new Date();
    lastTime = date;
    //checkFire(req, io);
    io.to("clients").emit("image", {
      img: req,
      time: date.toISOString(),
    }); //base64
  });

  socket.on("fire", (req) => {
    lastImage = req;
    const date = new Date();
    lastTime = date;
    checkFire(req, io);
    io.to("clients").emit("image", {
      img: req,
      time: date.toISOString(),
    });
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
