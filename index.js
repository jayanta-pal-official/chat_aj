import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(express.static(path.join("public")));

const users = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  //   socket.on("join-room", () => {
  //     users[socket.id] = socket;
  //     if (Object.keys(users).length === 2) {
  //       io.emit("ready");
  //     }
  //   });

  socket.on("offer", (offer) => {
    socket.broadcast.emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    socket.broadcast.emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate) => {
    socket.broadcast.emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log("Server running on http://localhost:4000");
});
