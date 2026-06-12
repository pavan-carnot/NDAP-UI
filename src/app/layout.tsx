import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "NDAP – National Data and Analytics Platform",
  description:
    "AI-powered government dataset intelligence — National Data and Analytics Platform, NITI Aayog.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden flex flex-col bg-ndap-bg">
        <Header />
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">{children}</main>
        {/* <Footer /> */}
      </body>
    </html>
  );
}
