import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-vt323",
});

export const metadata: Metadata = {
  title: "Ethereum Pixel NFT Mint",
  description: "Mint your pixel art NFT on Ethereum",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
  // Note: CSP is configured in next.config.js headers()
  // This metadata is for reference only
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${pressStart2P.variable} ${vt323.variable}`}>
      <body>
        {/* 在页面加载的最早阶段静默 MetaMask SDK 错误 - 使用内联脚本确保最早执行 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){var h=function(e){if(!e||!e.reason)return;var r=e.reason,m='';if(typeof r==='string')m=r;else if(r&&r.message)m=r.message;else if(r&&r.toString)m=r.toString();else if(r&&r.error&&r.error.message)m=r.error.message;var s=m.toLowerCase(),t=(r&&r.stack?r.stack:'').toLowerCase();if(s.indexOf('failed to connect to metamask')!==-1||s.indexOf('metamask extension not found')!==-1||s.indexOf('metamask')!==-1||t.indexOf('inpage.js')!==-1||t.indexOf('metamask')!==-1){e.preventDefault();e.stopPropagation();return false}};var g=function(e){if(!e)return;var m=(e.message||(e.error&&e.error.message)||'').toLowerCase(),f=(e.filename||'').toLowerCase();if(m.indexOf('failed to connect to metamask')!==-1||m.indexOf('metamask extension not found')!==-1||f.indexOf('inpage.js')!==-1||f.indexOf('metamask')!==-1){e.preventDefault();e.stopPropagation();return false}};if(window.addEventListener){window.addEventListener('unhandledrejection',h,true);window.addEventListener('error',g,true)}else if(window.attachEvent){window.attachEvent('onerror',g)}})();
            `,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

