import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, typography } from "../theme";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleRegister() {
    setError(null); setBusy(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>Join StudyRoom to call, chat, and share materials.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
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
        placeholder="Password (min 8 characters)"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.linkRow}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.linkTextBold}>Log in</Text></Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink, ...typography.display },
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
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13 },
});
