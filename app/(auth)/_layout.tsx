import { Stack } from "expo-router";

export default function AuthenticatedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding/first-scan" />
      <Stack.Screen name="onboarding/activation" />
      <Stack.Screen name="species/[speciesId]" />
      <Stack.Screen name="plants/save" />
      <Stack.Screen name="plants/[plantId]" />
      <Stack.Screen name="diagnosis/[draftId]" />
    </Stack>
  );
}
