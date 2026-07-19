import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { colors, spacing, radius } from "../theme";

export default function GroupsScreen({ navigation }) {
  const { token, user, logout } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setGroups(await api.listGroups(token));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleCreate() {
    if (!newGroupName.trim()) return;
    setBusy(true); setError(null);
    try {
      await api.createGroup(token, newGroupName.trim());
      setNewGroupName("");
      load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setBusy(true); setError(null);
    try {
      await api.joinGroup(token, joinCode.trim());
      setJoinCode("");
      load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your groups</Text>
          <Text style={styles.subtitle}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={logout}><Text style={styles.logout}>Log out</Text></TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={groups}
        keyExtractor={(g) => String(g.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No groups yet — create or join one below.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.groupCard} onPress={() => navigation.navigate("GroupDetail", { group: item })}>
            <View style={styles.groupCardAccent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.groupMeta}>{item.subject || "No subject"} · {item.member_count} member{item.member_count === 1 ? "" : "s"}</Text>
            </View>
            <View style={styles.codeChip}><Text style={styles.codeChipText}>{item.invite_code}</Text></View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 12 }}
      />

      <View style={styles.formRow}>
        <TextInput style={styles.input} placeholder="New group name" placeholderTextColor={colors.muted} value={newGroupName} onChangeText={setNewGroupName} />
        <TouchableOpacity style={styles.smallButton} onPress={handleCreate} disabled={busy}>
          <Text style={styles.smallButtonText}>Create</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.formRow}>
        <TextInput
          style={styles.input}
          placeholder="Invite code (e.g. AB12CD)"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          value={joinCode}
          onChangeText={setJoinCode}
        />
        <TouchableOpacity style={[styles.smallButton, styles.smallButtonAlt]} onPress={handleJoin} disabled={busy}>
          <Text style={styles.smallButtonAltText}>Join</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  logout: { color: colors.muted, fontSize: 13, marginTop: 6 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 13 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40, fontSize: 14 },
  groupCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  groupCardAccent: { width: 4, height: 36, borderRadius: 2, backgroundColor: colors.accent, marginRight: spacing.md },
  groupName: { fontSize: 16, fontWeight: "600", color: colors.ink },
  groupMeta: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  codeChip: { backgroundColor: colors.panelAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  codeChipText: { fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.5 },
  formRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm, alignItems: "center" },
  input: {
    flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.ink,
  },
  smallButton: { backgroundColor: colors.ink, borderRadius: radius.sm, paddingHorizontal: 18, paddingVertical: 12 },
  smallButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  smallButtonAlt: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  smallButtonAltText: { color: colors.ink, fontWeight: "600", fontSize: 13 },
});
