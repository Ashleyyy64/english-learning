import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lingua · 英语学习空间",
  description: "为每一个阶段设计的英语成长空间",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
