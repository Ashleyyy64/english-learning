"use client";

import { useEffect } from "react";

// 全局错误边界：捕获客户端运行时异常，避免白屏。
// 生产环境显示友好提示；同时把错误详情输出到控制台，便于排查。
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "80px auto",
        padding: 32,
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>页面加载出错</h1>
      <p style={{ color: "#666", marginBottom: 8 }}>抱歉，这个页面遇到了一点问题。</p>
      <details style={{ textAlign: "left", background: "#f7f8fa", padding: 12, borderRadius: 8, margin: "16px 0" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>错误详情（点击展开）</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#c0392b" }}>
          {error.message || "未知错误"}
        </pre>
      </details>
      <button
        onClick={reset}
        style={{
          padding: "10px 20px",
          background: "#4f46e5",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 15,
        }}
      >
        重试
      </button>
    </div>
  );
}
