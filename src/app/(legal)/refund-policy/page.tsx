import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { REFUND } from "@/lib/legal";

export const metadata: Metadata = { title: REFUND.title, description: REFUND.summary };

export default function Page() {
  return <LegalPage doc={REFUND} />;
}
