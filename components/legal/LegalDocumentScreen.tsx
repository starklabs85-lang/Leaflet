import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { LEGAL_LAST_UPDATED } from "@/constants/legal";
import { theme } from "@/constants/theme";

type LegalDocumentScreenProps = {
  sections: readonly { title: string; body: string }[];
  title: string;
};

export function LegalDocumentScreen({
  sections,
  title
}: LegalDocumentScreenProps) {
  return (
    <Screen>
      <PressableScale
        accessibilityLabel="Go back"
        accessibilityRole="button"
        haptic={false}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <MaterialCommunityIcons
          color={theme.colors.forest}
          name="chevron-left"
          size={24}
        />
        <Text style={styles.backText}>Back</Text>
      </PressableScale>

      <Text style={styles.eyebrow}>Leaflet legal</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.updated}>Last updated {LEGAL_LAST_UPDATED}</Text>

      <View style={styles.sections}>
        {sections.map((section) => (
          <Card key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    minHeight: 44
  },
  backText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  eyebrow: {
    ...theme.text.eyebrow,
    marginTop: theme.spacing.lg
  },
  title: {
    ...theme.text.display,
    marginTop: theme.spacing.sm
  },
  updated: {
    ...theme.text.caption,
    marginTop: theme.spacing.md
  },
  sections: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  },
  sectionTitle: {
    ...theme.text.heading
  },
  body: {
    ...theme.text.body,
    marginTop: theme.spacing.sm
  }
});
