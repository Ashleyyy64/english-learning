"use client";

import { Volume2 } from "lucide-react";
import { useTtsSpeak } from "@/components/use-tts-speak";

// 单词朗读按钮（独立小按钮，供 tts-check 诊断页等场景使用）
//
// 注意：单词卡片上的发音已改为「点击卡片本身」触发，业务页面不再使用本组件。
export default function SpeakerButton({ text }: { text: string }) {
  const { speak, speaking } = useTtsSpeak(text);

  return (
    <button
      type="button"
      className={`speaker-button ${speaking ? "speaking" : ""}`}
      onClick={speak}
      aria-label={`朗读 ${text}`}
      title="朗读"
    >
      <Volume2 size={19} />
      {speaking && (
        <span className="speaker-wave">
          <i />
          <i />
          <i />
        </span>
      )}
    </button>
  );
}
