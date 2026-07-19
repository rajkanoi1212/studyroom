# StudyRoom Server

Backend for StudyRoom: auth, study groups, PDF material sharing, real-time
group/private chat, and WebRTC call signaling — built with Node.js,
Express, Socket.io, and SQLite.

## Why this project

Unlike a typical request/response REST API, this backend has a genuine
real-time component: chat delivery and call signaling both need a
persistent connection (Socket.io) rather than polling, and the WebRTC
signaling logic has to correctly relay an offer/answer/ICE-candidate
handshake between two specific users without ever touching the actual
audio/video itself.

## Architecture

```
Express (REST)                    Socket.io (real-time)
  /api/auth        register/login    join_group
  /api/groups       create/join/list  send_message      -> new_message
  /api/groups/:id/materials  upload/list/download   call:invite      -> call:incoming
  /api/groups/:id/messages   history                call:accept      -> call:accepted
                                      call:offer       -> call:offer
SQLite (better-sqlite3)              call:answer      -> call:answer
  users, groups, group_members,      call:ice-candidate -> call:ice-candidate
  materials, messages                call:end/decline -> call:ended/declined
```

### Call signaling flow (the interesting part)

A naive implementation has a race condition: if the caller sends its SDP
offer as soon as the callee's phone shows an incoming-call banner, the
offer can arrive before the callee has actually built its `RTCPeerConnection`
and started listening — dropping the very first message of the handshake.

StudyRoom avoids this with an explicit `call:accept` step: the callee
builds its peer connection *first*, then signals `call:accept`, and only
*then* does the caller create and send its offer. ICE candidates that
arrive before the remote description is set are queued and flushed once
it is. See `src/sockets/index.js` and `mobile/src/screens/CallScreen.js`.

## Setup

```bash
npm install
npm start          # listens on port 4000
```

No separate database setup needed — SQLite is a single file
(`studyroom.db`), created automatically on first run.

## Tests

```bash
npm test
```

16 tests:
- **11 REST integration tests** — auth, groups, invite-code joining, PDF
  upload/download, membership permission checks
- **4 real-time signaling tests** using actual Socket.io client
  connections — a full offer → accept → answer → ICE → end handshake
  between two live sockets, and a DM-privacy test confirming a third group
  member never receives a private message not addressed to them
- **1 real WebRTC connection test** — using a real Node.js WebRTC engine
  (`@roamhq/wrtc`) to simulate two actual devices, this drives the exact
  handshake sequence the mobile app implements through the live signaling
  server and verifies two genuine peer connections reach `connected`
  state and successfully exchange data over a negotiated data channel —
  not just that JSON messages get relayed correctly, but that a real
  WebRTC call actually completes.

## Known limitations / next steps

- 1:1 calls only — group calls need either a mesh of peer connections
  (works for ~4 people) or an SFU media server (for more); noted as the
  natural next step
- No TURN server configured — calls will connect directly or via STUN in
  most cases, but two devices on restrictive/symmetric NATs may need a
  TURN relay for full reliability (a free option like Twilio's or Metered's
  would slot into `ICE_SERVERS` in `mobile/src/config.js`)
- SQLite is fine for a demo/portfolio scale; a real deployment would move
  to Postgres
- No push notifications — an incoming call/message only shows if the app
  is open and connected

## License

MIT
