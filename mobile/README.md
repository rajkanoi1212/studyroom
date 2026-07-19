# StudyRoom Mobile

React Native (Expo) app for StudyRoom — group study with real-time chat,
private DMs, PDF material sharing, and voice/video calling.

## Setup

```bash
npm install
```

Edit `src/config.js` and set `SERVER_HOST` to your computer's LAN IP
address (not `localhost` — your phone needs to reach your computer over
the network). Find it with `ipconfig` (Windows) or `ifconfig` / `ip addr`
(Mac/Linux). Make sure the [server](../server) is running
(`cd ../server && npm start`) and your phone is on the same WiFi network.

### Chat, groups, and materials — works in plain Expo Go

```bash
npx expo start
```
Scan the QR code with the Expo Go app on your phone. Everything except
calling works here, since it's all plain JavaScript.

### Calling — needs a custom dev client

`react-native-webrtc` is a native module, which the generic Expo Go app
doesn't include. To test calls on a real device:

```bash
npx expo run:android   # or: npx expo run:ios (requires a Mac)
```

This builds a custom version of the app with the native WebRTC module
included and installs it on a connected device or emulator — still free,
still no App Store submission needed, just a one-time extra build step
compared to Expo Go. After that first build, `npx expo start` and
reopening that installed app works like normal for day-to-day development.

## Testing a call

You need two devices (or a physical device + emulator) logged in as two
different users in the same group. Open the group's **Members** tab on one
device and tap **Call** next to the other user's name — they should get an
incoming-call banner they can accept from anywhere in the app.

## Architecture

```
App.js
 ├─ AuthProvider       — login state, persisted in AsyncStorage
 ├─ SocketProvider     — one Socket.io connection for the whole app;
 │                        surfaces incoming calls globally
 ├─ RootNavigator       — auth stack vs. main app stack
 └─ IncomingCallBanner — floats over any screen when a call comes in

src/screens/    Login, Register, Groups, GroupDetail, Call
src/components/ ChatTab, MaterialsTab, MembersTab, IncomingCallBanner
src/context/    AuthContext, SocketContext
src/api/        REST client
```

Group chat, DMs, and materials are backed by REST for history + Socket.io
for live delivery. Calls are peer-to-peer WebRTC, with the server only
relaying the signaling messages (offer/answer/ICE candidates) — it never
sees or touches the actual audio/video stream.

## Known limitations / next steps

- Calling requires the custom dev client build described above (not
  available in plain Expo Go) — this is a real constraint of using native
  WebRTC, not a bug
- 1:1 calls only, no group calling yet
- No push notifications — the app needs to be open to receive a call or
  message in real time
- No TURN server configured (see server README) — calls may not connect
  across some restrictive networks

## License

MIT
