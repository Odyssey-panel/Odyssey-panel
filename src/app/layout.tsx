import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/panel/providers";

export const metadata: Metadata = {
  title: "اودیسه — ODYSSEY",
  description:
    "اودیسه — مدیریت کاربران، ترافیک، لینک اشتراک و نودها؛ چند-پروتکل و ضد فیلترینگ. / ODYSSEY — multi-protocol anti-filter proxy & subscription control panel. Secure · Private · Fast.",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c1218" },
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
  ],
};

/**
 * Applies the saved language before first paint (default = Persian/RTL),
 * so there is no flash of the wrong direction.
 */
const langBootstrap = `try{var l=localStorage.getItem('odyssey.lang');if(l==='en'){document.documentElement.lang='en';document.documentElement.dir='ltr'}else{document.documentElement.lang='fa';document.documentElement.dir='rtl'}}catch(e){document.documentElement.lang='fa';document.documentElement.dir='rtl'}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: langBootstrap }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
