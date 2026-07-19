import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { RTCPeerConnection, RTCView, mediaDevices } from "react-native-webrtc";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { ICE_SERVERS } from "../config";
import { colors, spacing, radius } from "../theme";

// Call lifecycle:
//  CALLER:  mount -> emit call:invite -> wait for call:accepted -> get local
//           media, build RTCPeerConnection, create+send offer -> receive
//           answer -> connected
//  CALLEE:  mount (only happens after the user tapped Accept) -> get local
//           media, build RTCPeerConnection immediately, THEN emit
//           call:accept -> receive offer -> answer it -> connected
// Accepting locally before signaling "accepted" is what avoids a race
// where the caller's offer could arrive before the callee is listening.

export default function CallScreen({ route, navigation }) {
  const { peer, group, isCaller, incomingSdp } = route.params;
  const { socket } = useSocket();
  const { user } = useAuth();

  const [status, setStatus] = useState(isCaller ? "Calling…" : "Connecting…");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [ended, setEnded] = useState(false);

  const pcRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteDescSetRef = useRef(false);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
  }, [localStream]);

  const endCall = useCallback((notifyPeer = true) => {
    if (notifyPeer) socket?.emit("call:end", { toUserId: peer.id });
    cleanup();
    setEnded(true);
    navigation.goBack();
  }, [socket, peer.id, cleanup, navigation]);

  async function buildPeerConnection() {
    const stream = await mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
    setLocalStream(stream);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => setRemoteStream(event.streams[0]);
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("call:ice-candidate", { toUserId: peer.id, candidate: event.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (["failed", "closed"].includes(pc.connectionState)) endCall(false);
    };
    return pc;
  }

  async function flushPendingCandidates(pc) {
    for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c);
    pendingCandidatesRef.current = [];
  }

  useEffect(() => {
    if (!socket) return;

    async function startAsCaller() {
      const pc = await buildPeerConnection();
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", { toUserId: peer.id, sdp: pc.localDescription });
    }

    async function startAsCallee() {
      const pc = await buildPeerConnection();
      socket.emit("call:accept", { toUserId: peer.id });
      // If the offer already arrived (unlikely given the accept handshake,
      // but handled defensively), process it now instead of waiting.
      if (incomingSdp) await handleOffer(pc, incomingSdp);
    }

    async function handleOffer(pc, sdp) {
      await pc.setRemoteDescription(sdp);
      remoteDescSetRef.current = true;
      await flushPendingCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { toUserId: peer.id, sdp: pc.localDescription });
      setStatus("connecting…");
    }

    function onOffer({ fromUserId, sdp }) {
      if (fromUserId !== peer.id || !pcRef.current) return;
      handleOffer(pcRef.current, sdp);
    }
    async function onAnswer({ fromUserId, sdp }) {
      if (fromUserId !== peer.id || !pcRef.current) return;
      await pcRef.current.setRemoteDescription(sdp);
      remoteDescSetRef.current = true;
      await flushPendingCandidates(pcRef.current);
      setStatus("connecting…");
    }
    async function onIceCandidate({ fromUserId, candidate }) {
      if (fromUserId !== peer.id) return;
      if (remoteDescSetRef.current && pcRef.current) {
        await pcRef.current.addIceCandidate(candidate);
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    }
    function onDeclined({ fromUserId }) {
      if (fromUserId !== peer.id) return;
      setStatus("Call declined");
      setTimeout(() => endCall(false), 1200);
    }
    function onEnded({ fromUserId }) {
      if (fromUserId !== peer.id) return;
      setStatus("Call ended");
      setTimeout(() => endCall(false), 800);
    }
    async function onAccepted({ fromUserId }) {
      if (fromUserId !== peer.id || !isCaller) return;
      const pc = await buildPeerConnection();
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", { toUserId: peer.id, sdp: pc.localDescription });
      setStatus("connecting…");
    }

    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onIceCandidate);
    socket.on("call:declined", onDeclined);
    socket.on("call:ended", onEnded);
    socket.on("call:accepted", onAccepted);
    socket.on("call:failed", () => { setStatus("User is offline"); setTimeout(() => endCall(false), 1200); });

    if (isCaller) {
      socket.emit("call:invite", { toUserId: peer.id, groupId: group.id, fromName: user.name });
      // (offer is sent from onAccepted, once the callee confirms readiness)
    } else {
      startAsCallee();
    }

    return () => {
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice-candidate", onIceCandidate);
      socket.off("call:declined", onDeclined);
      socket.off("call:ended", onEnded);
      socket.off("call:accepted", onAccepted);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  function toggleMic() {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((v) => !v);
  }
  function toggleCam() {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((v) => !v);
  }

  return (
    <View style={styles.screen}>
      {remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.waitingScreen}>
          <View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{peer.name?.[0]?.toUpperCase()}</Text></View>
          <Text style={styles.peerName}>{peer.name}</Text>
          <Text style={styles.status}>{status}</Text>
          {status !== "Call declined" && status !== "Call ended" && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
        </View>
      )}

      {localStream && camOn && (
        <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" zOrder={1} mirror />
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlButton, !micOn && styles.controlButtonOff]} onPress={toggleMic}>
          <Text style={styles.controlIcon}>{micOn ? "🎤" : "🔇"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endButton} onPress={() => endCall(true)}>
          <Text style={styles.endIcon}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, !camOn && styles.controlButtonOff]} onPress={toggleCam}>
          <Text style={styles.controlIcon}>{camOn ? "📹" : "🚫"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  remoteVideo: { flex: 1 },
  waitingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarLarge: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  avatarLargeText: { color: "#fff", fontSize: 36, fontWeight: "700" },
  peerName: { color: "#fff", fontSize: 22, fontWeight: "700" },
  status: { color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 6 },
  localVideo: { position: "absolute", top: 60, right: 20, width: 100, height: 150, borderRadius: radius.md, backgroundColor: "#000" },
  controls: { position: "absolute", bottom: 50, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.xl },
  controlButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  controlButtonOff: { backgroundColor: "rgba(255,255,255,0.35)" },
  controlIcon: { fontSize: 22 },
  endButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", transform: [{ rotate: "135deg" }] },
  endIcon: { fontSize: 26 },
});
