import type { Metadata, Viewport } from "next";
import { AppLocaleProvider } from "./localization/locale-context";
import "./globals.css";
import "./styles/novel-workbench.css";
import "./styles/authoring.css";
import "./styles/town-shell.css";
import "./styles/command-center.css";
import "./styles/world-console.css";
import "./styles/investigation-review.css";
import "./styles/campaign-study.css";
import "./styles/presentation-pass.css";
import "./styles/noir-player.css";

export const metadata: Metadata = {
  title: "Detective Town",
  description: "走进雨夜小镇，追索证词与物证之间的真相。"
};

export const viewport: Viewport = { themeColor: "#0B1013" };

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const extensionErrorGuard = `
    (function () {
      var noisyPatterns = [
        'helper.aisouziyuan.com',
        'content-script.js',
        'content_main.js',
        '579.js',
        '861.js',
        'Failed to construct \\'URL\\': Invalid URL',
        'Failed to execute \\'setEnd\\' on \\'Range\\''
      ];
      function isNoisy(value) {
        var text = String(value && (value.stack || value.message || value.filename || value.reason || value) || '');
        return noisyPatterns.some(function (pattern) { return text.indexOf(pattern) !== -1; });
      }
      window.addEventListener('error', function (event) {
        if (isNoisy(event.error) || isNoisy(event.message) || isNoisy(event.filename)) {
          event.preventDefault();
          return false;
        }
      }, true);
      window.addEventListener('unhandledrejection', function (event) {
        if (isNoisy(event.reason)) {
          event.preventDefault();
          return false;
        }
      }, true);
    })();
  `;

  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/fonts/noir/fonts.css" />
        <meta name="google" content="notranslate" />
        <script dangerouslySetInnerHTML={{ __html: extensionErrorGuard }} />
      </head>
      <body><AppLocaleProvider>{children}</AppLocaleProvider></body>
    </html>
  );
}
