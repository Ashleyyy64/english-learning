"use client";

import { useMemo } from "react";

const POS_PATTERN = /(^|[^A-Za-z])(vt|vi|adj|adv|prep|conj|pron|num|art|int|aux|v|n)\./g;

// 将释义字符串拆分为多行：按分号/斜杠切分，词性前缀单独成行
export function splitMeaningParts(translation: string): string[] {
  return translation
    .split(/[；;]/)
    .flatMap((part) => part.split(/\s*\/\s*/))
    .flatMap((part) =>
      part
        .replace(
          POS_PATTERN,
          (_match, prefix: string, pos: string) => `${prefix}\n${pos}.`,
        )
        .split("\n"),
    )
    .map((part) => part.trim())
    .filter(Boolean);
}

// 共享的释义展示组件：用 useMemo 缓存拆分结果，避免每次渲染重复计算
export default function WordMeaning({ translation }: { translation: string }) {
  const parts = useMemo(() => splitMeaningParts(translation), [translation]);
  return (
    <div className="word-meaning">
      {parts.map((part, index) => (
        <div className="meaning-line" key={`${part}-${index}`}>
          <span className="meaning-dot" />
          <span>{part}</span>
        </div>
      ))}
    </div>
  );
}
