const db = require("../db");
const { verifyToken } = require("../auth");

function isMember(groupId, userId) {
  return !!db.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?").get(groupId, userId);
}
function dmKeyFor(a, b) {
  return [a, b].sort((x, y) => x - y).join("-");
}

function attachSocketHandlers(io) {
  // userId -> Set of connected socket ids (a user may have more than one
  // device/tab connected at once).
  const userSockets = new Map();

  function emitToUser(userId, event, payload) {
    const sockets = userSockets.get(userId);
    if (!sockets) return false;
    for (const socketId of sockets) io.to(socketId).emit(event, payload);
    return sockets.size > 0;
  }

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("missing auth token"));
      const payload = verifyToken(token);
      socket.userId = Number(payload.sub);
      next();
    } catch (e) {
      next(new Error("invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    socket.on("join_group", (groupId, ack) => {
      groupId = Number(groupId);
      if (!isMember(groupId, userId)) return ack?.({ error: "not a member of this group" });
      socket.join(`group:${groupId}`);
      ack?.({ ok: true });
    });

    socket.on("send_message", (payload, ack) => {
      const { groupId, roomType, peerId, body } = payload || {};
      if (!body || !body.trim()) return ack?.({ error: "message body is required" });
      const gid = Number(groupId);
      if (!isMember(gid, userId)) return ack?.({ error: "not a member of this group" });

      let dmKey = null;
      if (roomType === "dm") {
        if (!peerId || !isMember(gid, Number(peerId))) return ack?.({ error: "invalid dm peer" });
        dmKey = dmKeyFor(userId, Number(peerId));
      }

      const result = db
        .prepare(
          `INSERT INTO messages (group_id, room_type, dm_key, sender_id, body)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(gid, roomType === "dm" ? "dm" : "group", dmKey, userId, body.trim());

      const sender = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);
      const message = {
        id: result.lastInsertRowid,
        group_id: gid,
        room_type: roomType === "dm" ? "dm" : "group",
        sender_id: userId,
        sender_name: sender.name,
        body: body.trim(),
        created_at: new Date().toISOString(),
      };

      if (roomType === "dm") {
        emitToUser(Number(peerId), "new_message", message);
        emitToUser(userId, "new_message", message); // echo back to sender's other devices
      } else {
        io.to(`group:${gid}`).emit("new_message", message);
      }
      ack?.({ ok: true, message });
    });

    // --- WebRTC call signaling (1:1 calls) ---
    // The server never touches media — it only relays the SDP offer/answer
    // and ICE candidates between the two peers so they can establish a
    // direct (or STUN/TURN-relayed) connection themselves.
    socket.on("call:invite", ({ toUserId, groupId, fromName }) => {
      const delivered = emitToUser(Number(toUserId), "call:incoming", { fromUserId: userId, fromName, groupId });
      if (!delivered) socket.emit("call:failed", { reason: "user is offline" });
    });
    socket.on("call:accept", ({ toUserId }) => {
      emitToUser(Number(toUserId), "call:accepted", { fromUserId: userId });
    });
    socket.on("call:offer", ({ toUserId, sdp }) => {
      emitToUser(Number(toUserId), "call:offer", { fromUserId: userId, sdp });
    });
    socket.on("call:answer", ({ toUserId, sdp }) => {
      emitToUser(Number(toUserId), "call:answer", { fromUserId: userId, sdp });
    });
    socket.on("call:ice-candidate", ({ toUserId, candidate }) => {
      emitToUser(Number(toUserId), "call:ice-candidate", { fromUserId: userId, candidate });
    });
    socket.on("call:decline", ({ toUserId }) => {
      emitToUser(Number(toUserId), "call:declined", { fromUserId: userId });
    });
    socket.on("call:end", ({ toUserId }) => {
      emitToUser(Number(toUserId), "call:ended", { fromUserId: userId });
    });

    socket.on("disconnect", () => {
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(userId);
      }
    });
  });

  return { emitToUser };
}

module.exports = { attachSocketHandlers };
