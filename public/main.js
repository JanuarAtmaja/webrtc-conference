const socket = io();

const lobby = document.getElementById("lobby");
const meeting = document.getElementById("meeting");
const userNameInput = document.getElementById("userName");
const roomIdInput = document.getElementById("roomId");
const createRoomBtn = document.getElementById("createRoom");
const joinRoomBtn = document.getElementById("joinRoom");
const roomName = document.getElementById("roomName");
const copyRoomBtn = document.getElementById("copyRoom");
const participantCount = document.getElementById("participantCount");
const videoGrid = document.getElementById("videoGrid");
const localVideo = document.getElementById("localVideo");
const localName = document.getElementById("localName");
const localStatus = document.getElementById("localStatus");
const cameraBtn = document.getElementById("cameraBtn");
const micBtn = document.getElementById("micBtn");
const leaveBtn = document.getElementById("leaveBtn");
const statusText = document.getElementById("status");
let localStream;
let currentRoom;
let currentUserName;
let cameraEnabled = true;
let microphoneEnabled = true;
const peerConnections = new Map();
const pendingCandidates = new Map();
const peerNames = new Map();
// Fokus jaringan lokal: tidak bergantung pada STUN eksternal.
const config = {
iceServers: []
};
function setStatus(text) {
statusText.textContent = text;
}
function updateParticipantCount() {
const total = 1 + document.querySelectorAll(".remote-card").length;
participantCount.textContent = total + " Peserta";
}
function createRemoteCard(peerId, peerName, camera = true, microphone = true) {
let card = document.getElementById("peer-" + peerId);
if (card) {
const nameEl = card.querySelector(".participant-name");
if (nameEl) nameEl.textContent = peerName || "Peserta";
return card;
}

card = document.createElement("div");
card.className = "video-card remote-card";
card.id = "peer-" + peerId;
const video = document.createElement("video");
video.autoplay = true;
video.playsInline = true;
const info = document.createElement("div");
info.className = "video-info";
const name = document.createElement("span");
name.className = "participant-name";
name.textContent = peerName || "Peserta";
const mediaStatus = document.createElement("span");
mediaStatus.className = "media-status";
mediaStatus.textContent =
(camera ? "Camera ON" : "Camera OFF") +
" | " +
(microphone ? "Mic ON" : "Mic OFF");
info.appendChild(name);
info.appendChild(mediaStatus);
card.appendChild(video);
card.appendChild(info);
videoGrid.appendChild(card);
updateParticipantCount();
return card;
}
function removePeer(peerId) {
const pc = peerConnections.get(peerId);
if (pc) {
pc.close();
peerConnections.delete(peerId);
}
pendingCandidates.delete(peerId);
peerNames.delete(peerId);
const card = document.getElementById("peer-" + peerId);
if (card) card.remove();
updateParticipantCount();
}

function createPeerConnection(peerId, peerName) {
if (peerConnections.has(peerId)) {
return peerConnections.get(peerId);
}
peerNames.set(peerId, peerName || "Peserta");
const pc = new RTCPeerConnection(config);
peerConnections.set(peerId, pc);
localStream.getTracks().forEach((track) => {
pc.addTrack(track, localStream);
});
pc.ontrack = (event) => {
const card = createRemoteCard(
peerId,
peerNames.get(peerId) || "Peserta"
);
const video = card.querySelector("video");
if (event.streams[0] && video.srcObject !== event.streams[0]) {
video.srcObject = event.streams[0];
}
};
pc.onicecandidate = (event) => {
if (event.candidate) {
socket.emit("ice-candidate", {
target: peerId,
candidate: event.candidate
});
}
};
pc.onconnectionstatechange = () => {
console.log(peerId, pc.connectionState);
if (pc.connectionState === "connected") {
setStatus("Peserta berhasil terhubung.");
}
if (pc.connectionState === "failed") {
setStatus("Koneksi salah satu peserta gagal. Periksa jaringan/firewall.");
}
if (pc.connectionState === "closed") {
removePeer(peerId);
}

};
return pc;
}
async function flushPendingCandidates(peerId, pc) {
const candidates = pendingCandidates.get(peerId) || [];
for (const candidate of candidates) {
try {
await pc.addIceCandidate(new RTCIceCandidate(candidate));
} catch (error) {
console.error("ICE Error:", error);
}
}
pendingCandidates.delete(peerId);
}
function generateRoomId() {
return Math.random().toString(36).substring(2, 10);
}
createRoomBtn.addEventListener("click", async () => {
const name = userNameInput.value.trim();
if (!name) {
alert("Masukkan nama Anda.");
return;
}
const room = generateRoomId();
roomIdInput.value = room;
await joinConference(room, name);
});
joinRoomBtn.addEventListener("click", async () => {
const name = userNameInput.value.trim();
const room = roomIdInput.value.trim();
if (!name || !room) {
alert("Nama dan Room ID harus diisi.");
return;
}
await joinConference(room, name);
});
async function joinConference(room, name) {
try {

setStatus("Meminta akses kamera dan mikrofon...");
localStream = await navigator.mediaDevices.getUserMedia({
video: true,
audio: true
});
localVideo.srcObject = localStream;
currentRoom = room;
currentUserName = name;
localName.textContent = name + " (Anda)";
roomName.textContent = room;
lobby.hidden = true;
meeting.hidden = false;
socket.emit("join-room", {
roomId: room,
userName: name
});
setStatus("Masuk ke room " + room);
} catch (error) {
console.error(error);
alert("Tidak dapat mengakses kamera/mikrofon. Periksa HTTPS dan permission browser.");
}
}
socket.on("existing-users", async (users) => {
console.log("Peserta lama:", users);
if (users.length === 0) {
setStatus("Room dibuat. Menunggu peserta lain...");
return;
}
for (const user of users) {
peerNames.set(user.id, user.name);
createRemoteCard(
user.id,
user.name,
user.camera,
user.microphone
);
const pc = createPeerConnection(user.id, user.name);

const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
socket.emit("offer", {
target: user.id,
sdp: pc.localDescription
});
}
});
socket.on("user-joined", ({ id, name, camera, microphone }) => {
peerNames.set(id, name);
createRemoteCard(id, name, camera, microphone);
setStatus(`${name} bergabung ke conference.`);
});
socket.on("offer", async ({ from, name, sdp }) => {
peerNames.set(from, name);
const pc = createPeerConnection(from, name);
await pc.setRemoteDescription(
new RTCSessionDescription(sdp)
);
await flushPendingCandidates(from, pc);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
socket.emit("answer", {
target: from,
sdp: pc.localDescription
});
});
socket.on("answer", async ({ from, sdp }) => {
const pc = peerConnections.get(from);
if (!pc) return;
await pc.setRemoteDescription(
new RTCSessionDescription(sdp)
);
await flushPendingCandidates(from, pc);
});
socket.on("ice-candidate", async ({ from, candidate }) => {
if (!candidate) return;

const pc = peerConnections.get(from);
if (!pc || !pc.remoteDescription) {
const list = pendingCandidates.get(from) || [];
list.push(candidate);
pendingCandidates.set(from, list);
return;
}
try {
await pc.addIceCandidate(
new RTCIceCandidate(candidate)
);
} catch (error) {
console.error("ICE Candidate Error:", error);
}
});
cameraBtn.addEventListener("click", () => {
if (!localStream) return;
const tracks = localStream.getVideoTracks();
if (tracks.length === 0) return;
cameraEnabled = !cameraEnabled;
tracks.forEach((track) => {
track.enabled = cameraEnabled;
});
cameraBtn.textContent = cameraEnabled
? "Matikan Kamera"
: "Nyalakan Kamera";
updateLocalMediaStatus();
sendMediaStatus();
});
micBtn.addEventListener("click", () => {
if (!localStream) return;
const tracks = localStream.getAudioTracks();
if (tracks.length === 0) return;
microphoneEnabled = !microphoneEnabled;
tracks.forEach((track) => {
track.enabled = microphoneEnabled;
});

micBtn.textContent = microphoneEnabled
? "Matikan Mikrofon"
: "Nyalakan Mikrofon";
updateLocalMediaStatus();
sendMediaStatus();
});
function updateLocalMediaStatus() {
localStatus.textContent =
(cameraEnabled ? "Camera ON" : "Camera OFF") +
" | " +
(microphoneEnabled ? "Mic ON" : "Mic OFF");
}
function sendMediaStatus() {
socket.emit("media-status", {
camera: cameraEnabled,
microphone: microphoneEnabled
});
}
socket.on("media-status", ({ id, camera, microphone }) => {
const card = document.getElementById("peer-" + id);
if (!card) return;
const status = card.querySelector(".media-status");
status.textContent =
(camera ? "Camera ON" : "Camera OFF") +
" | " +
(microphone ? "Mic ON" : "Mic OFF");
});
socket.on("user-left", ({ id, name }) => {
removePeer(id);
setStatus(`${name || "Peserta"} keluar dari conference.`);
});
copyRoomBtn.addEventListener("click", async () => {
await navigator.clipboard.writeText(currentRoom);
alert("Token room berhasil disalin.");
});
leaveBtn.addEventListener("click", () => {
socket.emit("leave-room");
if (localStream) {
localStream.getTracks().forEach((track) => {

track.stop();
});
}
peerConnections.forEach((pc) => {
pc.close();
});
peerConnections.clear();
location.reload();
});
socket.on("app-error", (message) => {
alert(message);
});