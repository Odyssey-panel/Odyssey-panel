import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit, Vazirmatn } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/panel/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const vazirmatn = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "اودیسه پنل — Odyssey Panel",
  description:
    "پنل مدیریت پروکسی و اشتراک، رایگان و سلف‌هاست: کاربران، محدودیت ترافیک، لینک اشتراک، QR، بررسی سلامت نودها و اسکنر پورت. / Free self-hosted proxy & subscription control panel.",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0d16" },
    { media: "(prefers-color-scheme: light)", color: "#f7f6fb" },
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${vazirmatn.variable} antialiased bg-background text-foreground`}
      >
        <script dangerouslySetInnerHTML={{ __html: langBootstrap }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
