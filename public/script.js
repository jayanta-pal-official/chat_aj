// client.js
const socket = io();
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startBtn = document.getElementById("btn");

let localStream;
let remoteStream = new MediaStream();

let isInitiator = false;
let config = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

const createPeerConnection = (function () {
  let peerConnection;

  const newPeer = () => {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };

    peerConnection.onconnectionstatechange = (event) => {
      console.log("Connection state:", peerConnection.connectionState);
    };

    peerConnection.onsignalingstatechange = (event) => {
      console.log("Signaling state:", peerConnection.signalingState);
    };

    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      console.log("Received remote track");
      remoteVideo.srcObject = event.streams[0];
    };
    return peerConnection;
  };

  return {
    getInt: () => {
      if (!peerConnection) {
        return newPeer();
      } else {
        return peerConnection;
      }
    },
  };
})();

async function startCall() {
  const pc = createPeerConnection.getInt();
  try {
    console.log("Starting call as initiator");

    // Only create and send offer if we're the initiator
    if (pc) {
      console.log("Creating offer");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(pc.localDescription);
      socket.emit("offer", pc.localDescription);
    }
  } catch (error) {
    console.error("Error starting call:", error);
  }
}

async function handleOffer(offer) {
  const pc = createPeerConnection.getInt();
  try {
    if (pc) {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", pc.localDescription);
    }
  } catch (error) {
    console.error("Error handling offer:", error);
  }
}

async function handleAnswer(answer) {
  let pc = createPeerConnection.getInt();
  try {
    if (pc) {
      await pc.setRemoteDescription(answer);
    } else {
      console.warn("Received answer in incorrect state:");
    }
  } catch (error) {
    console.error("Error handling answer:", error);
  }
}
async function startVideo() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;
}

socket.on("connect", () => {
  console.log("Connected to signaling server");
});

startVideo();
startBtn.addEventListener("click", startCall);
// Socket event handlers
socket.on("offer", handleOffer);
socket.on("answer", handleAnswer);

socket.on("ice-candidate", async (candidate) => {
  const pc = createPeerConnection.getInt();
  try {
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (error) {
    console.error("Error adding ICE candidate:", error);
  }
});

// Cleanup on window unload
window.onbeforeunload = () => {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  if (peerConnection) {
    peerConnection.close();
  }
  socket.close();
};
