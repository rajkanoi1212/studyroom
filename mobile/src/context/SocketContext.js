import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  // The most recent incoming call invite, if any — screens (e.g. a global
  // banner) can watch this to react to a call ringing regardless of which
  // screen the user is currently on.
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("call:incoming", (payload) => setIncomingCall(payload));
    socket.on("call:declined", () => setIncomingCall(null));
    socket.on("call:ended", () => setIncomingCall(null));

    return () => socket.disconnect();
  }, [token]);

  const joinGroup = useCallback((groupId) => {
    return new Promise((resolve) => socketRef.current?.emit("join_group", groupId, resolve));
  }, []);

  const sendMessage = useCallback((payload) => {
    return new Promise((resolve) => socketRef.current?.emit("send_message", payload, resolve));
  }, []);

  const clearIncomingCall = useCallback(() => setIncomingCall(null), []);

  return (
    <SocketContext.Provider
      value={{ socket: socketRef.current, connected, joinGroup, sendMessage, incomingCall, clearIncomingCall }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
