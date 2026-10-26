"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 单词朗读逻辑（可复用 hook）
//
// 发音策略（上线可用的完整方案）：
// 1. 首选：后端 /api/tts 用 edge-tts 合成标准美式发音（微软神经网络音色），
//    返回 mp3 直接播放。所有用户零配置、离线缓存、标准发音。
// 2. 兜底：若 TTS 请求失败（网络/后端异常），回退到浏览器 speechSynthesis
//    （用系统默认音色朗读，保证一定能出声）。
export function useTtsSpeak(text: string) {
  const [speaking, setSpeaking] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // 清理：组件卸载时停止正在播放的音频
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
    };
  }, []);

  // 兜底：浏览器 speechSynthesis（系统默认音色）
  const speakFallback = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    // 不指定 lang/voice，用系统默认音色立刻朗读
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
  }, [text]);

  const speak = useCallback(() => {
    const word = (text || "").trim();
    if (!word) return;

    setSpeaking(true);

    // 用 TTS API 播放标准发音
    const url = `/api/tts?word=${encodeURIComponent(word)}`;
    const audio = new Audio(url);
    ttsAudioRef.current = audio;

    let played = false;
    audio.onplaying = () => {
      played = true;
      setSpeaking(true);
    };
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => {
      // TTS 失败，回退到浏览器合成
      setSpeaking(false);
      if (!played) speakFallback();
    };

    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // play() 被拒绝（如自动播放策略），回退
        setSpeaking(false);
        speakFallback();
      });
    }
  }, [text, speakFallback]);

  return { speak, speaking };
}
