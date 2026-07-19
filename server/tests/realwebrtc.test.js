const http = require("http");
const request = require("supertest");
const { Server } = require("socket.io");
const Client = require("socket.io-client");
const wrtc = require("@roamhq/wrtc");
const { createApp } = require("../src/app");
const { attachSocketHandlers } = require("../src/sockets");

const { RTCPeerConnection } = wrtc;

let httpServer, io, baseUrl, app;

beforeAll((done) => {
  app = createApp();
  httpServer = http.createServer(app);
  io = new Server(httpServer);
  attachSocketHandlers(io);
  httpServer.listen(() => {
    baseUrl = `http://localhost:${httpServer.address().port}`;
    done();
  });
});

afterAll((done) => {
  io.close();
  httpServer.close(done);
});

async function registerUser(name, email) {
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "password123" });
  return res.body;
}

function connectClient(token) {
  return Client(baseUrl, { auth: { token }, transports: ["websocket"], forceNew: true });
}

// Mirrors the exact handshake implemented in mobile/src/screens/CallScreen.js:
// caller invites -> callee builds its peer connection -> callee signals
// accept -> ONLY THEN does the caller create+send its offer -> callee
// answers -> ICE candidates flow both ways (queued if they arrive before
// the remote description is set) -> connection reaches "connected".
function wireCallerFlow(socket, pc, peerUserId, groupId, fromName) {
  const pendingCandidates = [];
  let remoteDescSet = false;

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("call:ice-candidate", { toUserId: peerUserId, candidate: e.candidate });
  };

  socket.on("call:accepted", async ({ fromUserId }) => {
    if (fromUserId !== peerUserId) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("call:offer", { toUserId: peerUserId, sdp: pc.localDescription });
  });

  socket.on("call:answer", async ({ fromUserId, sdp }) => {
    if (fromUserId !== peerUserId) return;
    await pc.setRemoteDescription(sdp);
    remoteDescSet = true;
    for (const c of pendingCandidates.splice(0)) await pc.addIceCandidate(c);
  });

  socket.on("call:ice-candidate", async ({ fromUserId, candidate }) => {
    if (fromUserId !== peerUserId) return;
    if (remoteDescSet) await pc.addIceCandidate(candidate);
    else pendingCandidates.push(candidate);
  });

  socket.emit("call:invite", { toUserId: peerUserId, groupId, fromName });
}

function wireCalleeFlow(socket, pc, peerUserId) {
  const pendingCandidates = [];
  let remoteDescSet = false;

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("call:ice-candidate", { toUserId: peerUserId, candidate: e.candidate });
  };

  socket.on("call:offer", async ({ fromUserId, sdp }) => {
    if (fromUserId !== peerUserId) return;
    await pc.setRemoteDescription(sdp);
    remoteDescSet = true;
    for (const c of pendingCandidates.splice(0)) await pc.addIceCandidate(c);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("call:answer", { toUserId: peerUserId, sdp: pc.localDescription });
  });

  socket.on("call:ice-candidate", async ({ fromUserId, candidate }) => {
    if (fromUserId !== peerUserId) return;
    if (remoteDescSet) await pc.addIceCandidate(candidate);
    else pendingCandidates.push(candidate);
  });

  // Callee's peer connection is already built by the time this fires —
  // exactly the ordering the race-condition fix depends on.
  socket.emit("call:accept", { toUserId: peerUserId });
}

describe("real WebRTC call (not just signaling relay)", () => {
  test("two real peer connections reach 'connected' state through the live server", async () => {
    const alice = await registerUser("AliceWebRTC", "alicewebrtc@test.com");
    const bob = await registerUser("BobWebRTC", "bobwebrtc@test.com");
    const group = (await request(app).post("/api/groups").set("Authorization", `Bearer ${alice.token}`).send({ name: "WebRTC Group" })).body;
    await request(app).post("/api/groups/join").set("Authorization", `Bearer ${bob.token}`).send({ invite_code: group.invite_code });

    const aliceSocket = connectClient(alice.token);
    const bobSocket = connectClient(bob.token);
    await Promise.all([aliceSocket, bobSocket].map((s) => new Promise((r) => s.on("connect", r))));

    const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    const alicePc = new RTCPeerConnection({ iceServers });
    const bobPc = new RTCPeerConnection({ iceServers });

    // A real data channel — if this opens, we have a genuine, fully
    // negotiated peer-to-peer connection, not just relayed JSON messages.
    const dataChannel = alicePc.createDataChannel("test");
    const dataChannelOpen = new Promise((resolve) => dataChannel.addEventListener("open", resolve));

    let bobReceivedChannel = null;
    const bobChannelPromise = new Promise((resolve) => {
      bobPc.ondatachannel = (e) => { bobReceivedChannel = e.channel; resolve(e.channel); };
    });

    const aliceConnected = new Promise((resolve) => {
      alicePc.onconnectionstatechange = () => { if (alicePc.connectionState === "connected") resolve(); };
    });
    const bobConnected = new Promise((resolve) => {
      bobPc.onconnectionstatechange = () => { if (bobPc.connectionState === "connected") resolve(); };
    });

    wireCallerFlow(aliceSocket, alicePc, bob.user.id, group.id, "AliceWebRTC");
    wireCalleeFlow(bobSocket, bobPc, alice.user.id);

    await Promise.all([aliceConnected, bobConnected]);
    await bobChannelPromise;

    // Prove data actually flows over the negotiated connection.
    const messageReceived = new Promise((resolve) => {
      bobReceivedChannel.addEventListener("message", (e) => resolve(e.data));
    });
    await dataChannelOpen;
    dataChannel.send("hello from a real webrtc connection");
    expect(await messageReceived).toBe("hello from a real webrtc connection");

    alicePc.close(); bobPc.close();
    aliceSocket.close(); bobSocket.close();
  }, 20000);
});
