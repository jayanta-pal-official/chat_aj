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
  console.log("socket connected:", socket.id);

  socket.on("join-room", (roomId, id, name) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = name;
    socket.to(roomId).emit("new-user", id, name);
  });

  socket.on("offer", (offer, id, userid) => {
    io.to(userid).emit("offer", offer, id);
  });

  socket.on("answer", (answer, id, userId) => {
    io.to(userId).emit("answer", answer, id);
  });

  socket.on("candidate", (candidate, id, userid) => {
    io.to(userid).emit("candidate", candidate, id);
  });
  socket.on("leave", (userId) => {
    if (socket.roomId) {
      io.to(socket.roomId).emit("user-disconnected", userId);
      console.log(`User ${userId} left room ${socket.roomId}`);
    }

    socket.leave(socket.roomId); // Remove user from the room
  });

  socket.on("disconnect", () => {
    if (socket.roomId) {
      io.to(socket.roomId).emit("user-disconnected", socket.id);
      console.log(`User ${socket.id} disconnected from ${socket.roomId}`);
    }
  });
});
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log("Server running on http://localhost:4000");
});
