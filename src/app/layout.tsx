import type { Metadata } from "next";
import { DM_Sans, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "DueForm",
  description: "Create invoices, send PDFs, and track payments with DueForm.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

const themeBootScript = `
  (function () {
    try {
      var stored = window.localStorage.getItem("${THEME_STORAGE_KEY}");
      var allowed = ["slate-blue", "soft-ivory", "muted-olive"];
      var theme = allowed.indexOf(stored || "") >= 0 ? stored : "${DEFAULT_THEME}";
      document.documentElement.dataset.theme = theme;
    } catch (error) {
      document.documentElement.dataset.theme = "${DEFAULT_THEME}";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfair.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className="min-h-screen font-[family-name:var(--font-body)] noise-bg"
        style={{
          background: "var(--color-bg)",
          color: "var(--color-text)",
        }}
      >
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-bg-card)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
            },
          }}
        />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
