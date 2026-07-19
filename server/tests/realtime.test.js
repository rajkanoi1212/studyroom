const http = require("http");
const request = require("supertest");
const { Server } = require("socket.io");
const Client = require("socket.io-client");
const { createApp } = require("../src/app");
const { attachSocketHandlers } = require("../src/sockets");

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
  return res.body; // { user, token }
}

function connectClient(token) {
  return Client(baseUrl, { auth: { token }, transports: ["websocket"], forceNew: true });
}

describe("real-time chat", () => {
  test("group message sent by one member is received by another", async () => {
    const alice = await registerUser("Alice", "alice-rt@test.com");
    const group = (await request(app).post("/api/groups").set("Authorization", `Bearer ${alice.token}`).send({ name: "RT Group" })).body;
    const bob = await registerUser("Bob", "bob-rt@test.com");
    await request(app).post("/api/groups/join").set("Authorization", `Bearer ${bob.token}`).send({ invite_code: group.invite_code });

    const aliceSocket = connectClient(alice.token);
    const bobSocket = connectClient(bob.token);

    await new Promise((resolve) => aliceSocket.on("connect", resolve));
    await new Promise((resolve) => bobSocket.on("connect", resolve));

    await new Promise((resolve) => aliceSocket.emit("join_group", group.id, resolve));
    await new Promise((resolve) => bobSocket.emit("join_group", group.id, resolve));

    const received = new Promise((resolve) => bobSocket.once("new_message", resolve));
    aliceSocket.emit("send_message", { groupId: group.id, roomType: "group", body: "hey group!" });

    const msg = await received;
    expect(msg.body).toBe("hey group!");
    expect(msg.sender_name).toBe("Alice");

    aliceSocket.close();
    bobSocket.close();
  });

  test("DM is only received by the intended peer, not other group members", async () => {
    const alice = await registerUser("Alice2", "alice2-rt@test.com");
    const group = (await request(app).post("/api/groups").set("Authorization", `Bearer ${alice.token}`).send({ name: "DM Group" })).body;
    const bob = await registerUser("Bob2", "bob2-rt@test.com");
    const carl = await registerUser("Carl2", "carl2-rt@test.com");
    await request(app).post("/api/groups/join").set("Authorization", `Bearer ${bob.token}`).send({ invite_code: group.invite_code });
    await request(app).post("/api/groups/join").set("Authorization", `Bearer ${carl.token}`).send({ invite_code: group.invite_code });

    const aliceSocket = connectClient(alice.token);
    const bobSocket = connectClient(bob.token);
    const carlSocket = connectClient(carl.token);
    await Promise.all([aliceSocket, bobSocket, carlSocket].map((s) => new Promise((r) => s.on("connect", r))));

    let carlReceivedDm = false;
    carlSocket.on("new_message", () => { carlReceivedDm = true; });

    const bobReceived = new Promise((resolve) => bobSocket.once("new_message", resolve));
    aliceSocket.emit("send_message", { groupId: group.id, roomType: "dm", peerId: bob.user.id, body: "just between us" });

    const msg = await bobReceived;
    expect(msg.body).toBe("just between us");
    expect(msg.room_type).toBe("dm");

    await new Promise((r) => setTimeout(r, 200)); // give Carl a chance to (not) receive it
    expect(carlReceivedDm).toBe(false);

    aliceSocket.close(); bobSocket.close(); carlSocket.close();
  });
});

describe("call signaling", () => {
  test("full offer/answer/ICE/end handshake relays correctly between two peers", async () => {
    const alice = await registerUser("AliceCall", "alicecall@test.com");
    const bob = await registerUser("BobCall", "bobcall@test.com");
    const group = (await request(app).post("/api/groups").set("Authorization", `Bearer ${alice.token}`).send({ name: "Call Group" })).body;
    await request(app).post("/api/groups/join").set("Authorization", `Bearer ${bob.token}`).send({ invite_code: group.invite_code });

    const aliceSocket = connectClient(alice.token);
    const bobSocket = connectClient(bob.token);
    await Promise.all([aliceSocket, bobSocket].map((s) => new Promise((r) => s.on("connect", r))));

    // Alice invites Bob
    const invitePromise = new Promise((resolve) => bobSocket.once("call:incoming", resolve));
    aliceSocket.emit("call:invite", { toUserId: bob.user.id, groupId: group.id, fromName: "AliceCall" });
    const invite = await invitePromise;
    expect(invite.fromUserId).toBe(alice.user.id);

    // Bob accepts, Alice is notified before any SDP is exchanged
    const acceptedPromise = new Promise((resolve) => aliceSocket.once("call:accepted", resolve));
    bobSocket.emit("call:accept", { toUserId: alice.user.id });
    const accepted = await acceptedPromise;
    expect(accepted.fromUserId).toBe(bob.user.id);

    // Alice sends SDP offer, Bob receives it
    const offerPromise = new Promise((resolve) => bobSocket.once("call:offer", resolve));
    aliceSocket.emit("call:offer", { toUserId: bob.user.id, sdp: "fake-offer-sdp" });
    const offer = await offerPromise;
    expect(offer.sdp).toBe("fake-offer-sdp");
    expect(offer.fromUserId).toBe(alice.user.id);

    // Bob answers
    const answerPromise = new Promise((resolve) => aliceSocket.once("call:answer", resolve));
    bobSocket.emit("call:answer", { toUserId: alice.user.id, sdp: "fake-answer-sdp" });
    const answer = await answerPromise;
    expect(answer.sdp).toBe("fake-answer-sdp");

    // ICE candidates flow both ways
    const aliceIcePromise = new Promise((resolve) => aliceSocket.once("call:ice-candidate", resolve));
    bobSocket.emit("call:ice-candidate", { toUserId: alice.user.id, candidate: { candidate: "bob-candidate" } });
    expect((await aliceIcePromise).candidate.candidate).toBe("bob-candidate");

    // Either side can end the call
    const endPromise = new Promise((resolve) => aliceSocket.once("call:ended", resolve));
    bobSocket.emit("call:end", { toUserId: alice.user.id });
    await endPromise;

    aliceSocket.close(); bobSocket.close();
  });

  test("inviting an offline user gets call:failed", async () => {
    const alice = await registerUser("AliceOffline", "aliceoffline@test.com");
    const aliceSocket = connectClient(alice.token);
    await new Promise((r) => aliceSocket.on("connect", r));

    const failedPromise = new Promise((resolve) => aliceSocket.once("call:failed", resolve));
    aliceSocket.emit("call:invite", { toUserId: 999999, groupId: 1, fromName: "AliceOffline" });
    const failure = await failedPromise;
    expect(failure.reason).toBe("user is offline");

    aliceSocket.close();
  });
});
