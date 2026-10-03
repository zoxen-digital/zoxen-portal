"use client";

import { useEffect, useState } from "react";

function fmt(d: Date, dateOnly?: boolean, timeZone?: string) {
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });
  return dateOnly ? date : `${date}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}`;
}

/** Date/time in the viewer's own time zone. The first render uses UTC so server and browser HTML match. */
export function LocalTime({ iso, dateOnly }: { iso: string; dateOnly?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => setText(fmt(new Date(iso), dateOnly)), [iso, dateOnly]);
  return <time dateTime={iso}>{text ?? fmt(new Date(iso), true, "UTC")}</time>;
}
