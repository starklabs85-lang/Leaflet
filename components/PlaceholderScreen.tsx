import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";

type PlaceholderScreenProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  body: string;
  illustration?: ReactNode;
}>;

export function PlaceholderScreen({
  eyebrow,
  title,
  body,
  illustration,
  children
}: PlaceholderScreenProps) {
  return (
    <Screen contentContainerStyle={styles.content}>
      {illustration ? (
        <View style={styles.illustration}>{illustration}</View>
      ) : null}
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children ? <View style={styles.children}>{children}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center"
  },
  illustration: {
    alignItems: "center",
    marginBottom: theme.spacing.xl
  },
  eyebrow: {
    ...theme.text.eyebrow
  },
  title: {
    ...theme.text.display,
    marginTop: theme.spacing.sm
  },
  body: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginTop: theme.spacing.md
  },
  children: {
    marginTop: theme.spacing.xl
  }
});
