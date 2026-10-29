import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Bulk Job Application Platform",
  description: "Automate personalized, recruiter-tailored job application emails with Google Gemini and verified SMTP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-white py-6 text-center text-xs text-slate-500">
          <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} AI-Powered Bulk Job Application Website. Truthful, verified outreach.</p>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-400">Strict Anti-Hallucination Grounding</span>
              <span>•</span>
              <span className="text-slate-400">Authentic SMTP Delivery</span>
            </div>
          </div>
        </footer>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

