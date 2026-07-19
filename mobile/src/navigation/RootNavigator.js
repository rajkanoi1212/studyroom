import React from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import GroupsScreen from "../screens/GroupsScreen";
import GroupDetailScreen from "../screens/GroupDetailScreen";
import CallScreen from "../screens/CallScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Groups" component={GroupsScreen} />
          <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
          <Stack.Screen name="Call" component={CallScreen} options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
