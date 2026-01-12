import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Powercast AI - Intelligent Grid Forecasting",
  description: "AI-powered forecasting and optimization platform for Swiss power grid operations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <Sidebar />
          <div className="main-content">
            <Header />
            <div className="page-content">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
