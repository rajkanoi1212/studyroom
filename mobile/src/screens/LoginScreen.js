import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, typography } from "../theme";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setError(null); setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>StudyRoom</Text>
      <Text style={styles.subtitle}>Call, chat, and share materials with your study group.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Log in</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Register")} style={styles.linkRow}>
        <Text style={styles.linkText}>New here? <Text style={styles.linkTextBold}>Create an account</Text></Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "700", color: colors.ink, ...typography.display },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 28 },
  input: {
    backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.ink, marginBottom: 12,
  },
  primaryButton: { backgroundColor: colors.ink, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  linkRow: { marginTop: 20, alignItems: "center" },
  linkText: { color: colors.muted, fontSize: 14 },
  linkTextBold: { color: colors.accent, fontWeight: "600" },
  error: { color: colors.danger, backgroundColor: "#FDECEA", padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13 },
});
