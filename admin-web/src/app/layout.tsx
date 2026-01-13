import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppWrapper from "@/components/layout/AppWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Baseteen Admin - Ministério do Adolescente",
  description: "Painel administrativo de gamificação e ranking",
  metadataBase: new URL('https://baseteen.vercel.app'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased text-text-primary`}>
        <AppWrapper>
          {children}
        </AppWrapper>
      </body>
    </html>
  );
}


