import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fieldnotes — a place for ideas",
  description: "A calm, private workspace for pages and notes.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const saved=localStorage.getItem("fieldnotes-theme");document.documentElement.dataset.theme=saved==="light"||saved==="dark"?saved:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch{document.documentElement.dataset.theme="light"}` }} />
      </head>
      <body className="antialiased">
        <ClerkProvider appearance={{ variables: {
          colorPrimary: "var(--accent)",
          colorPrimaryForeground: "var(--accent-foreground)",
          colorBackground: "var(--surface)",
          colorForeground: "var(--ink)",
          colorInput: "var(--input-surface)",
          colorInputForeground: "var(--ink)",
          colorMuted: "var(--surface-soft)",
          colorMutedForeground: "var(--muted)",
          colorBorder: "var(--line)",
        } }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
