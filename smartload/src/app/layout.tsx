import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartLoad AI",
  description: "Inteligentna platforma spedycyjna",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function(){
            const saved = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if(saved === 'dark' || (!saved && prefersDark)){
              document.documentElement.classList.add('dark');
            }
            document.documentElement.classList.add('theme-loaded');
          })();
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
