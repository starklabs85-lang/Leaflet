import { Stack } from "expo-router";

export default function PublicLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="onboarding/welcome" />
      <Stack.Screen name="onboarding/sign-in" />
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/eula" />
      <Stack.Screen name="legal/terms" />
    </Stack>
  );
}
