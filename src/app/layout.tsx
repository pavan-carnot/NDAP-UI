import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SidebarProvider } from "@/lib/sidebar-context";
import { LanguageProvider } from "@/lib/language-context";

export const metadata: Metadata = {
  title: "IHFC – Context-aware Conversational AI",
  description:
    "IHFC — Context-aware conversational AI with multi-domain expertise integration. Technology Innovation Hub of IIT Delhi.",
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
        <LanguageProvider>
          <SidebarProvider>
            <Header />
            <main className="flex-1 flex flex-col overflow-hidden min-h-0">{children}</main>
            {/* <Footer /> */}
          </SidebarProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
