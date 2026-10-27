"use client";

// 根布局错误边界：捕获 layout 层的错误（比 app/error.tsx 更顶层）。
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div
          style={{
            maxWidth: 560,
            margin: "80px auto",
            padding: 32,
            fontFamily: "system-ui, -apple-system, sans-serif",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>应用加载出错</h1>
          <p style={{ color: "#666", marginBottom: 8 }}>系统遇到了一个异常，请稍后重试。</p>
          <pre style={{ textAlign: "left", background: "#f7f8fa", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 13, color: "#c0392b" }}>
            {error.message || "未知错误"}
          </pre>
          <button
            onClick={reset}
            style={{ padding: "10px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
