import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { AuthProvider } from "@/components/providers/auth-provider"
import { Header } from "@/components/layout/header"
import { ChatAssistant } from "@/components/chat/chat-assistant"
import { Toaster } from "react-hot-toast"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Powercast AI – Multi-Plant Power Forecasting Command Center",
  description: "AI-powered grid forecasting platform for energy portfolio management with XGBoost ML predictions and optimization suggestions",
  generator: "v0.app",
  applicationName: "Powercast AI",
  keywords: ["energy", "power forecasting", "grid", "solar", "hydro", "nuclear", "thermal", "wind", "AI", "machine learning"],
  authors: [{ name: "Powercast AI Team" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Powercast AI",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#e4ebf5",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#e4ebf5" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <Header />
              <div className="pt-16">
                {children}
              </div>
              <ChatAssistant />
              <Toaster 
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: 'var(--neu-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--neu-border)',
                    boxShadow: 'var(--shadow-raised)',
                  },
                }}
              />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
