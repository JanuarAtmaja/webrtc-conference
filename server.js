const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const app = express();
const PORT = 8080;
const options = {
key: fs.readFileSync(path.join(__dirname, "ssl", "key.pem")),
cert: fs.readFileSync(path.join(__dirname, "ssl", "cert.pem")),
};
app.use(express.static(path.join(__dirname, "public")));
const server = https.createServer(options, app);
const io = new Server(server);
function getUsersInRoom(roomId) {
const room = io.sockets.adapter.rooms.get(roomId);
if (!room) return [];
return [...room].map((id) => {
const client = io.sockets.sockets.get(id);
return {
id,
name: client?.data?.userName || "Peserta",
camera: client?.data?.camera ?? true,
microphone: client?.data?.microphone ?? true,
};
});

}
function targetInSameRoom(socket, targetId) {
const target = io.sockets.sockets.get(targetId);
return Boolean(
target && socket.data.roomId && target.data.roomId === socket.data.roomId,
);
}
io.on("connection", (socket) => {
console.log("User terhubung:", socket.id);
socket.on("join-room", ({ roomId, userName }) => {
roomId = String(roomId || "")
.trim()
.replace(/[^a-zA-Z0-9_-]/g, "");
userName = String(userName || "Peserta")
.trim()
.slice(0, 30);
if (!roomId) {
socket.emit("app-error", "Room ID tidak valid.");
return;
}
const existingUsers = getUsersInRoom(roomId);
socket.join(roomId);
socket.data.roomId = roomId;
socket.data.userName = userName;
socket.data.camera = true;
socket.data.microphone = true;
socket.emit("existing-users", existingUsers);
socket.to(roomId).emit("user-joined", {
id: socket.id,
name: userName,
camera: true,
microphone: true,
});
console.log(`${userName} bergabung ke room ${roomId}`);
});
socket.on("offer", (payload) => {
if (!targetInSameRoom(socket, payload.target)) return;

io.to(payload.target).emit("offer", {
from: socket.id,
name: socket.data.userName,
sdp: payload.sdp,
});
});
socket.on("answer", (payload) => {
if (!targetInSameRoom(socket, payload.target)) return;
io.to(payload.target).emit("answer", {
from: socket.id,
sdp: payload.sdp,
});
});
socket.on("ice-candidate", (payload) => {
if (!targetInSameRoom(socket, payload.target)) return;
io.to(payload.target).emit("ice-candidate", {
from: socket.id,
candidate: payload.candidate,
});
});
socket.on("media-status", ({ camera, microphone }) => {
const roomId = socket.data.roomId;
if (!roomId) return;
socket.data.camera = Boolean(camera);
socket.data.microphone = Boolean(microphone);
socket.to(roomId).emit("media-status", {
id: socket.id,
camera: socket.data.camera,
microphone: socket.data.microphone,
});
});
socket.on("leave-room", () => {
const roomId = socket.data.roomId;
if (!roomId) return;
socket.to(roomId).emit("user-left", {
id: socket.id,
name: socket.data.userName,
});

socket.leave(roomId);
socket.data.roomId = null;
});
socket.on("disconnecting", () => {
const roomId = socket.data.roomId;
if (!roomId) return;
socket.to(roomId).emit("user-left", {
id: socket.id,
name: socket.data.userName,
});
});
socket.on("disconnect", () => {
console.log("User terputus:", socket.id);
});
});
server.listen(PORT, "0.0.0.0", () => {
console.log(`Server HTTPS berjalan di port ${PORT}`);
console.log(`https://localhost:${PORT}`);
console.log(`atau https://IP-SERVER:${PORT}`);
});