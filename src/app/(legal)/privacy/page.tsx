import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = { title: PRIVACY.title, description: PRIVACY.summary };

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
