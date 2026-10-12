import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: TERMS.title, description: TERMS.summary };

export default function Page() {
  return <LegalPage doc={TERMS} />;
}
