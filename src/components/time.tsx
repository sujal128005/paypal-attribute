"use client";

import { useEffect, useState } from "react";
import { dateTime, relativeTime } from "@/lib/util";

/** Renders times in the viewer's timezone without server/client hydration mismatches. */
export function Time({ iso, mode = "datetime" }: { iso: string; mode?: "datetime" | "relative" }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setText(mode === "relative" ? relativeTime(iso) : dateTime(iso));
    update();
    if (mode !== "relative") return;
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [iso, mode]);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text ?? " "}
    </time>
  );
}
