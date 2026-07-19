import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSocket } from "../context/SocketContext";
import { navigationRef } from "../navigation/navigationRef";
import { colors, spacing, radius } from "../theme";

export default function IncomingCallBanner() {
  const { socket, incomingCall, clearIncomingCall } = useSocket();
  if (!incomingCall) return null;

  function decline() {
    socket?.emit("call:decline", { toUserId: incomingCall.fromUserId });
    clearIncomingCall();
  }

  function accept() {
    const peer = { id: incomingCall.fromUserId, name: incomingCall.fromName };
    clearIncomingCall();
    navigationRef.current?.navigate("Call", { peer, group: { id: incomingCall.groupId }, isCaller: false });
  }

  return (
    <View style={styles.banner}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{incomingCall.fromName?.[0]?.toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{incomingCall.fromName}</Text>
        <Text style={styles.sub}>Incoming call…</Text>
      </View>
      <TouchableOpacity style={styles.declineButton} onPress={decline}><Text style={styles.buttonIcon}>✕</Text></TouchableOpacity>
      <TouchableOpacity style={styles.acceptButton} onPress={accept}><Text style={styles.buttonIcon}>✓</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute", top: 50, left: 16, right: 16, backgroundColor: colors.ink, borderRadius: radius.lg,
    padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8, zIndex: 999,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700" },
  name: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sub: { color: "rgba(255,255,255,0.65)", fontSize: 12.5, marginTop: 1 },
  declineButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  acceptButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  buttonIcon: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
