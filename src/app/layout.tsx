import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Sora } from "next/font/google";
import "./globals.css";
import { DialogProvider } from "@/components/Dialogs";

// Same type as the Zoxen website: Sora for headings and numbers, Hanken Grotesk for text.
const sora = Sora({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600", "700", "800"], display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Zoxen Digital", template: "%s | Zoxen Digital" },
  description: "Client management and invoicing for Zoxen Digital.",
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Zoxen", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#2639e8",
};

// Applies the saved theme before paint. Public invoice, quote and contract pages always stay light.
const themeScript = `try{if(!/^\\/(invoice|quote|contract)\\//.test(location.pathname)&&localStorage.getItem('zx-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sora.variable} ${hanken.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
