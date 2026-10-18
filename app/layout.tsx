import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fieldnotes — a place for ideas",
  description: "A calm, private workspace for pages and notes.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fieldnotes",
  },
};

export const viewport: Viewport = {
  themeColor: "#406853",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
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
