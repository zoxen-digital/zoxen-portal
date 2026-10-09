import { cn } from "@/lib/utils";

const URL_RX = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

/** Plain text with web links turned into clickable links (opened in a new tab). */
export function Linkify({ text, light }: { text: string; light?: boolean }) {
  const parts = text.split(URL_RX);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className={cn("break-all font-semibold underline", light ? "text-white" : "text-brand dark:text-[#8f9bff]")}>
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}
