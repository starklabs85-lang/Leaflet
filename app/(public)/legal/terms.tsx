import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";
import { TERMS_SECTIONS } from "@/constants/legal";

export default function TermsScreen() {
  return <LegalDocumentScreen title="Terms of Service" sections={TERMS_SECTIONS} />;
}
