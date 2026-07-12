// App.js — Root navigation
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import RoutesScreen from "./src/screens/RoutesScreen";
import { colours } from "./src/theme";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colours.bg },
          animation: "slide_from_bottom",
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Routes" component={RoutesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
