import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { ErrorProvider } from "@/contexts/ErrorContext";
import { AppErrorBoundary } from "@/components/ui/ErrorBoundaries";
import { MCPProvider } from "@/lib/mcp/context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Ad Manager v4",
  description: "AI-powered advertising management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} antialiased`}
      >
        <ErrorProvider>
          <AppErrorBoundary>
            <AuthProvider>
              <MCPProvider 
                config={{
                  clientConfig: {
                    serverUrl: process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3004'
                  },
                  enableDebugLogging: true,
                  logConnectionEvents: true
                }}
              >
                <DashboardProvider>
                  {children}
                </DashboardProvider>
              </MCPProvider>
            </AuthProvider>
          </AppErrorBoundary>
        </ErrorProvider>
      </body>
    </html>
  );
}
