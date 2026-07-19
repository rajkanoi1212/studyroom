import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { SocketProvider } from "./src/context/SocketContext";
import { navigationRef } from "./src/navigation/navigationRef";
import RootNavigator from "./src/navigation/RootNavigator";
import IncomingCallBanner from "./src/components/IncomingCallBanner";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <NavigationContainer ref={navigationRef}>
            <RootNavigator />
            <IncomingCallBanner />
          </NavigationContainer>
          <StatusBar style="dark" />
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
