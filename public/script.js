// client.js
const socket = io();
const videoGrid = document.getElementById("video-grid");
const muteButton = document.getElementById("muteButton");
const videoButton = document.getElementById("videoButton");
const startBtn = document.getElementById("btn");
const endButton = document.getElementById("end");
const inputName = document.getElementById("input");

const peerConnections = {};
const pendingCandidates = {};
let localStream;

// ✅ Create local video element and append it to the grid
const localVideo = document.createElement("video");
localVideo.muted = true;
videoGrid.appendChild(localVideo);

// ✅ WebRTC Configuration
const config = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

// ✅ Function to create a new peer connection per user
// ✅ Create Peer Connection for Each User and Ensure It Handles ontrack
function createPeerConnection(userId) {
  const peer = new RTCPeerConnection(config);
  peerConnections[userId] = peer;

  // ✅ Ensure each peer listens for tracks (for first tab issue)
  peer.ontrack = (event) => {
    console.log(`🔹 Receiving stream from ${userId}`);
    addVideoStream(event.streams[0], userId);
  };

  // ✅ Handle ICE candidates
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", event.candidate, socket.id, userId);
    }
  };

  return peer;
}

// ✅ Fix: Handle Incoming Offers and Attach Streams

async function handleOffer(offer, userId) {
  console.log(`📩 Offer received from ${userId}`);

  const peer = createPeerConnection(userId);

  await peer.setRemoteDescription(new RTCSessionDescription(offer)); // ✅ Set Remote Description first

  // ✅ Apply stored ICE candidates after remote description is set
  if (pendingCandidates[userId]) {
    console.log(`✅ Adding stored ICE candidates for ${userId}`);
    pendingCandidates[userId].forEach((candidate) => {
      peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    });
    pendingCandidates[userId] = []; // Clear after adding
  }

  // ✅ Ensure Local Stream is Available
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: { noiseSuppression: true, echoCancellation: true },
    });

    localVideo.srcObject = localStream;
    localVideo.autoplay = true;
    localVideo.muted = true;
  }

  // ✅ Add Local Stream to Peer Connection
  if (!peerConnections[userId].hasAddedTracks) {
    localStream
      .getTracks()
      .forEach((track) => peer.addTrack(track, localStream));
    peerConnections[userId].hasAddedTracks = true; // ✅ Prevent multiple calls
  }

  // ✅ Create Answer and Send it Back
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("answer", peer.localDescription, socket.id, userId);
}

// ✅ Start the call
async function startCall() {
  if (!inputName.value) {
    alert("Please enter a Name!");
    return;
  }
  let name = inputName.value;
  try {
    socket.emit("join-room", "room1", socket.id, name);
    await startVideo();
  } catch (error) {
    console.error("Error starting call:", error);
  }
}

// ✅ Get User Media and show local stream
async function startVideo() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: { noiseSuppression: true, echoCancellation: true },
  });

  localVideo.srcObject = localStream;
  localVideo.autoplay = true;

  // Show buttons
  endButton.classList.remove("hidden");
  startBtn.classList.add("hidden");
  muteButton.classList.remove("hidden");
  videoButton.classList.remove("hidden");
}

// ✅ Connect to a new user
async function connectToNewUser(userId) {
  console.log(`📡 Connecting to new user: ${userId}`);

  const peer = createPeerConnection(userId);

  // ✅ Ensure Local Stream is Available
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: { noiseSuppression: true, echoCancellation: true },
    });

    localVideo.srcObject = localStream;
    localVideo.autoplay = true;
    localVideo.muted = true;
  }

  // ✅ Add Local Stream to Peer Connection
  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

  // ✅ Create and Send Offer
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("offer", peer.localDescription, socket.id, userId);
}

// ✅ Add Video Stream to UI
function addVideoStream(stream, userId) {
  let existingVideo = document.getElementById(userId);
  if (existingVideo) {
    console.warn(`🚨 Video for ${userId} already exists. Skipping duplicate.`);
    return;
  }

  const video = document.createElement("video");
  video.srcObject = stream;
  video.id = userId;
  video.autoplay = true;
  videoGrid.appendChild(video);
}

// ✅ Remove user video when they leave
function removeVideo(userId) {
  const video = document.getElementById(userId);
  if (video) video.remove();
}

// ✅ Handle Socket Events
socket.on("connect", () => {
  console.log("Connected to signaling server");
});

// ✅ When a new user joins
socket.on("new-user", async (id, username) => {
  console.log(`${username} joined the call`);
  await startVideo();
  connectToNewUser(id);
});

// ✅ Handle incoming offer
socket.on("offer", (offer, userId) => {
  handleOffer(offer, userId);
});

// ✅ Handle incoming answer
socket.on("answer", async (answer, userId) => {
  if (peerConnections[userId]) {
    console.log(`Setting remote description for answer from ${userId}`);
    await peerConnections[userId].setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  }
});

// ✅ Handle ICE candidates
socket.on("candidate", (candidate, id) => {
  if (peerConnections[id] && peerConnections[id].remoteDescription) {
    peerConnections[id]
      .addIceCandidate(new RTCIceCandidate(candidate))
      .catch((error) => console.error("Error adding ICE candidate:", error));
  } else {
    console.warn(
      `⏳ Storing ICE candidate for ${id} until remote description is set.`
    );
    if (!pendingCandidates[id]) pendingCandidates[id] = [];
    pendingCandidates[id].push(candidate);
  }
});
socket.on("user-disconnected", (userId) => {
  console.log(`User ${userId} disconnected`);
  removeVideo(userId); // Remove video from UI
  if (peerConnections[userId]) {
    peerConnections[userId].close();
    delete peerConnections[userId];
  }
});
// ✅ Cleanup on window unload
window.onbeforeunload = () => {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }

  Object.values(peerConnections).forEach((peer) => peer.close());

  socket.close();
};

// ✅ Attach event to start call
startBtn.addEventListener("click", startCall);
// Toggle Mute/Unmute
muteButton.addEventListener("click", () => {
  if (localStream) {
    let audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      muteButton.textContent = audioTrack.enabled ? "Mute" : "Unmute"; // Change button text
    }
  }
});

// Toggle Video On/Off
videoButton.addEventListener("click", () => {
  if (localStream) {
    let videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      videoButton.textContent = videoTrack.enabled
        ? "Stop Video"
        : "Start Video"; // Change button text
    }
  }
});

// End Call (Leave Room)
endButton.addEventListener("click", () => {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop()); // Stop all media tracks
  }

  // Close peer connections
  for (let peerId in peerConnections) {
    peerConnections[peerId].close();
    delete peerConnections[peerId];
  }

  // Remove local video
  localVideo.srcObject = null;
  videoGrid.innerHTML = ""; // Clear all videos
  endButton.classList.add("hidden");
  startBtn.classList.remove("hidden");
  muteButton.classList.add("hidden");
  videoButton.classList.add("hidden");

  socket.emit("leave", socket.id); // Inform server
});
