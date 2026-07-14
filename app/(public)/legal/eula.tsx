import { Linking } from "react-native";

import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";
import { Button } from "@/components/ui/Button";
import { STANDARD_EULA_SECTIONS, STANDARD_EULA_URL } from "@/constants/legal";

export default function StandardEulaScreen() {
  return (
    <LegalDocumentScreen
      title="Standard EULA"
      sections={STANDARD_EULA_SECTIONS}
      footer={
        <Button
          accessibilityLabel="Open Apple Standard EULA"
          icon="open-in-new"
          iconPosition="trailing"
          label="Open Apple Standard EULA"
          onPress={() => {
            Linking.openURL(STANDARD_EULA_URL).catch(() => undefined);
          }}
          variant="secondary"
        />
      }
    />
  );
}
