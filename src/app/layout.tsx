import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { DialogProvider } from "@/components/Dialogs";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Zoxen Digital", template: "%s | Zoxen Digital" },
  description: "Client management and invoicing for Zoxen Digital.",
  icons: { icon: "/icon.svg" },
};

// Applies the saved theme before paint. Public invoice pages always stay light.
const themeScript = `try{if(!location.pathname.startsWith('/invoice/')&&localStorage.getItem('zx-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
