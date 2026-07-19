import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ChatTab from "../components/ChatTab";
import MaterialsTab from "../components/MaterialsTab";
import MembersTab from "../components/MembersTab";
import { colors, spacing, radius } from "../theme";

const TABS = ["Chat", "Materials", "Members"];

export default function GroupDetailScreen({ route, navigation }) {
  const { group } = route.params;
  const [tab, setTab] = useState("Chat");

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Groups</Text></TouchableOpacity>
        <Text style={styles.title}>{group.name}</Text>
        <View style={styles.codeChip}><Text style={styles.codeChipText}>Invite: {group.invite_code}</Text></View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tabButton, tab === t && styles.tabButtonActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {tab === "Chat" && <ChatTab group={group} />}
        {tab === "Materials" && <MaterialsTab group={group} />}
        {tab === "Members" && <MembersTab group={group} navigation={navigation} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  back: { color: colors.accent, fontSize: 15, fontWeight: "600", marginBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  codeChip: { alignSelf: "flex-start", backgroundColor: colors.panelAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  codeChipText: { fontSize: 11.5, fontWeight: "600", color: colors.muted },
  tabBar: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  tabButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  tabButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  tabTextActive: { color: "#fff" },
});
