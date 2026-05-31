import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";
import { PRIVACY_POLICY_SECTIONS } from "@/constants/legal";

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      sections={PRIVACY_POLICY_SECTIONS}
    />
  );
}
