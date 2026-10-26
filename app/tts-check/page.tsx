"use client";

import { useEffect, useRef, useState } from "react";
import SpeakerButton from "@/components/speaker-button";

// 临时诊断页：/tts-check
export default function TtsCheckPage() {
  const [log, setLog] = useState<string[]>([]);
  const [env, setEnv] = useState<string>("");

  const push = (m: string) => setLog((l) => [...l, m]);

  useEffect(() => {
    const has = typeof window !== "undefined" && "speechSynthesis" in window;
    setEnv(
      has
        ? `speechSynthesis 存在；getVoices() 立即返回 ${window.speechSynthesis.getVoices().length} 个`
        : "❌ 浏览器不支持 speechSynthesis"
    );
    if (!has) return;
    const t = setTimeout(() => {
      const v = window.speechSynthesis.getVoices();
      push(`[延时] 1s 后 getVoices() 返回 ${v.length} 个`);
      v.forEach((x) => push(`   - ${x.name} | ${x.lang} | local=${x.localService}`));
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  // 原始测试：不调用 cancel、不指定 voice
  const raw = () => {
    const u = new SpeechSynthesisUtterance("hello");
    u.lang = "en-US";
    u.onstart = () => push("RAW ✅ onstart");
    u.onend = () => push("RAW ✅ onend");
    u.onerror = (e) => push(`RAW ❌ onerror: ${e.error}`);
    push("RAW 调用 speak()（不 cancel）");
    window.speechSynthesis.speak(u);
  };

  // 复现组件逻辑：cancel() 后立刻 speak()
  const withCancel = () => {
    const u = new SpeechSynthesisUtterance("hello");
    u.lang = "en-US";
    u.onstart = () => push("CANCEL ✅ onstart");
    u.onend = () => push("CANCEL ✅ onend");
    u.onerror = (e) => push(`CANCEL ❌ onerror: ${e.error}`);
    push("CANCEL 调用 cancel() 后立即 speak()");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 20, fontFamily: "system-ui" }}>
      <h1>TTS 诊断</h1>
      <p>{env}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <button onClick={raw}>原始 speak()</button>
        <button onClick={withCancel}>cancel() + speak()</button>
      </div>
      <div style={{ margin: "16px 0" }}>
        组件按钮：<SpeakerButton text="hello" />
      </div>
      <pre
        style={{ background: "#f7f8fa", padding: 14, borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap" }}
      >
        {log.join("\n") || "等待操作…"}
      </pre>
    </div>
  );
}
