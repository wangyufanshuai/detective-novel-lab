import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "逻辑之王推理工坊",
  description: "分阶段生成公平推理中文短篇小说的 AI 创作工作台"
};

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
    <html lang="zh-CN">
      <head>
        <meta name="google" content="notranslate" />
        <script dangerouslySetInnerHTML={{ __html: extensionErrorGuard }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
