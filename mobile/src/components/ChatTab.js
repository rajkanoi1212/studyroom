import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { api } from "../api/client";
import { colors, spacing, radius } from "../theme";

export default function ChatTab({ group }) {
  const { user, token } = useAuth();
  const { socket, joinGroup, sendMessage } = useSocket();
  const [members, setMembers] = useState([]);
  const [activeThread, setActiveThread] = useState({ type: "group" }); // { type: 'group' } | { type: 'dm', peer }
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    api.groupMembers(token, group.id).then((m) => setMembers(m.filter((mem) => mem.id !== user.id))).catch(() => {});
  }, [group.id, token, user.id]);

  useEffect(() => { joinGroup(group.id); }, [group.id, joinGroup]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const room = activeThread.type === "dm" ? "dm" : "group";
      const peer = activeThread.type === "dm" ? activeThread.peer.id : undefined;
      const history = await api.messageHistory(token, group.id, room, peer);
      setMessages(history);
    } catch (e) { /* ignore */ } finally { setLoading(false); }
  }, [activeThread, group.id, token]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (!socket) return;
    function onNewMessage(msg) {
      const belongsToActiveThread =
        activeThread.type === "group"
          ? msg.room_type === "group" && msg.group_id === group.id
          : msg.room_type === "dm" && msg.group_id === group.id &&
            (msg.sender_id === activeThread.peer.id || msg.sender_id === user.id);
      if (belongsToActiveThread) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      }
    }
    socket.on("new_message", onNewMessage);
    return () => socket.off("new_message", onNewMessage);
  }, [socket, activeThread, group.id, user.id]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const payload = activeThread.type === "dm"
      ? { groupId: group.id, roomType: "dm", peerId: activeThread.peer.id, body }
      : { groupId: group.id, roomType: "group", body };
    const result = await sendMessage(payload);
    if (result?.message) {
      setMessages((prev) => [...prev, result.message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ type: "group" }, ...members.map((m) => ({ type: "dm", peer: m }))]}
        keyExtractor={(item) => (item.type === "group" ? "group" : `dm-${item.peer.id}`)}
        contentContainerStyle={styles.pillRow}
        renderItem={({ item }) => {
          const isActive = item.type === "group" ? activeThread.type === "group" : activeThread.type === "dm" && activeThread.peer.id === item.peer.id;
          return (
            <TouchableOpacity style={[styles.pill, isActive && styles.pillActive]} onPress={() => setActiveThread(item)}>
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{item.type === "group" ? "Group chat" : item.peer.name}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet — say hi!</Text>}
          renderItem={({ item }) => {
            const mine = item.sender_id === user.id;
            return (
              <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine && activeThread.type === "group" && <Text style={styles.senderName}>{item.sender_name}</Text>}
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={activeThread.type === "dm" ? `Message ${activeThread.peer.name}…` : "Message the group…"}
            placeholderTextColor={colors.muted}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSend}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pillRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  pill: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  pillText: { fontSize: 12.5, fontWeight: "600", color: colors.muted },
  pillTextActive: { color: "#fff" },
  empty: { color: colors.muted, textAlign: "center", marginTop: 30, fontSize: 13.5 },
  bubbleRow: { flexDirection: "row" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "78%", borderRadius: radius.lg, paddingVertical: 9, paddingHorizontal: 13 },
  bubbleTheirs: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  senderName: { fontSize: 10.5, fontWeight: "700", color: colors.secondary, marginBottom: 2 },
  bubbleText: { fontSize: 14.5, color: colors.ink, lineHeight: 20 },
  bubbleTextMine: { color: "#fff" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  input: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14.5, color: colors.ink, maxHeight: 100 },
  sendButton: { backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 11 },
  sendButtonText: { color: "#fff", fontWeight: "600", fontSize: 13.5 },
});
