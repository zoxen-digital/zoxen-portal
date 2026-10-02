"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("zx-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="relative flex h-10 w-[72px] items-center rounded-full border border-line bg-surface-2 p-1 transition"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <span
        className={`absolute top-1 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-all duration-300 ${
          dark ? "left-[34px] bg-brand-gradient text-white" : "left-1 bg-white text-amber-500"
        }`}
      >
        {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
      <Sun className={`ml-2 h-3.5 w-3.5 ${dark ? "text-muted" : "opacity-0"}`} />
      <Moon className={`ml-auto mr-2 h-3.5 w-3.5 ${dark ? "opacity-0" : "text-muted"}`} />
    </button>
  );
}
