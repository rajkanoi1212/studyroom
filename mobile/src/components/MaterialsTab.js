import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { colors, spacing, radius } from "../theme";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MaterialsTab({ group }) {
  const { token } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setMaterials(await api.listMaterials(token, group.id));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [group.id, token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleUpload() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    setUploading(true); setError(null);
    try {
      await api.uploadMaterial(token, group.id, file);
      load();
    } catch (e) { setError(e.message); } finally { setUploading(false); }
  }

  async function handleOpen(material) {
    setOpeningId(material.id);
    try {
      const url = api.materialDownloadUrl(group.id, material.id);
      const dest = FileSystem.cacheDirectory + material.original_name;
      const download = FileSystem.createDownloadResumable(url, dest, { headers: { Authorization: `Bearer ${token}` } });
      const { uri } = await download.downloadAsync();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      } else {
        Alert.alert("Downloaded", `Saved to ${uri}`);
      }
    } catch (e) {
      Alert.alert("Couldn't open file", e.message);
    } finally {
      setOpeningId(null);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <View style={{ flex: 1 }}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={materials}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={<Text style={styles.empty}>No materials shared yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleOpen(item)} disabled={openingId === item.id}>
            <View style={styles.pdfIcon}><Text style={styles.pdfIconText}>PDF</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>{item.original_name}</Text>
              <Text style={styles.fileMeta}>{formatSize(item.size_bytes)} · shared by {item.uploader_name}</Text>
            </View>
            {openingId === item.id && <ActivityIndicator color={colors.accent} />}
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.uploadButton} onPress={handleUpload} disabled={uploading}>
        {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadButtonText}>+ Share a PDF</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: 8, marginHorizontal: spacing.lg, marginTop: spacing.sm, fontSize: 13 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 30, fontSize: 13.5 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md,
  },
  pdfIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.dangerSoft, alignItems: "center", justifyContent: "center" },
  pdfIconText: { color: colors.danger, fontWeight: "800", fontSize: 10.5 },
  fileName: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  fileMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  uploadButton: { backgroundColor: colors.ink, margin: spacing.lg, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  uploadButtonText: { color: "#fff", fontWeight: "600", fontSize: 14.5 },
});
