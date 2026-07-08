import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Aevra — Your life, beautifully remembered.",
  description:
    "Aevra is an AI memory journal that turns your days into a living, searchable, narratable archive of your life.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-body grain antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
