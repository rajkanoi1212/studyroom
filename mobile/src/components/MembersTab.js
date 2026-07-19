import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { colors, spacing, radius } from "../theme";

function initials(name) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function MembersTab({ group, navigation }) {
  const { user, token } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api.groupMembers(token, group.id).then(setMembers).finally(() => setLoading(false));
    }, [group.id, token])
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <FlatList
      data={members}
      keyExtractor={(m) => String(m.id)}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      renderItem={({ item }) => {
        const isMe = item.id === user.id;
        return (
          <View style={styles.card}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(item.name)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}{isMe ? " (you)" : ""}</Text>
              <Text style={styles.role}>{item.role === "owner" ? "Group owner" : "Member"}</Text>
            </View>
            {!isMe && (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => navigation.navigate("Call", { peer: item, group, isCaller: true })}
              >
                <Text style={styles.callButtonText}>📞 Call</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.secondarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.secondary, fontWeight: "700", fontSize: 14 },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink },
  role: { fontSize: 12, color: colors.muted, marginTop: 1 },
  callButton: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  callButtonText: { color: colors.accent, fontWeight: "700", fontSize: 12.5 },
});
