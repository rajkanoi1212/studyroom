// IMPORTANT: "localhost" on a phone means the phone itself, not your
// computer — so this must be your computer's LAN IP address (e.g.
// 192.168.1.42) when testing on a real device or in a dev client, so the
// phone can reach the server running on your machine. Find yours with
// `ipconfig` (Windows) or `ifconfig`/`ip addr` (Mac/Linux). The Android
// emulator specifically can use 10.0.2.2 to reach your machine's
// localhost instead.
//
// Keep the server (`cd server && npm start`) and phone on the same WiFi
// network for this to work.

export const SERVER_HOST = "192.168.1.42"; // <-- change this to your computer's LAN IP
export const SERVER_PORT = 4000;
export const API_BASE = `http://${SERVER_HOST}:${SERVER_PORT}/api`;
export const SOCKET_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

// Public STUN server for WebRTC NAT traversal (free, no signup). This is
// enough for two devices on the same network or many home networks; a
// TURN server would be needed for full reliability across arbitrary
// networks — see README for notes on adding one.
export const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
