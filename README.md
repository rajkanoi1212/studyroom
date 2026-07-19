# StudyRoom

A mobile app for group study: create a study group, share PDF materials,
chat as a group or privately, and voice/video call each other — built
with React Native (Expo) and a Node.js/Socket.io backend.

## Why this project

The other projects in this portfolio are request/response systems. This
one is a real-time system: chat and calls both need a persistent
connection rather than polling, and the call feature specifically means
implementing a WebRTC signaling handshake correctly — including a race
condition (offer arriving before the receiver is ready to accept it) that
a naive implementation would hit and that's now covered by a regression
test.

## Structure

```
server/   Node.js + Express + Socket.io + SQLite backend
mobile/   React Native (Expo) app
```

Each has its own README with setup instructions — start with
[`server/README.md`](server/README.md), then [`mobile/README.md`](mobile/README.md).

## Features

- **Groups** — create a group, invite others with a 6-character code
- **Materials** — share and download PDFs within a group
- **Chat** — real-time group chat, plus private 1:1 messages scoped to
  each group (for subgroup/project-team conversations)
- **Calls** — voice/video calling via WebRTC, with an incoming-call
  banner that shows no matter what screen you're on

## Tests

Backend: 15 tests (11 REST integration, 4 real-time — including a full
WebRTC signaling handshake between two live socket connections and a
DM-privacy check). Run with `cd server && npm test`.

## License

MIT
