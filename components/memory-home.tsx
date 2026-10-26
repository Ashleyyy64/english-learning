"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Play, TrendingUp } from "lucide-react";

type MemoryData = {
  total: number;
  todayDue: number;
  daily: { date: string; count: number }[];
};

// 艾宾浩斯遗忘曲线图（平滑面积曲线 + 渐变填充 + 网格 + 数据点）
function MemoryChart({ daily }: { daily: { date: string; count: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  const W = 720;
  const H = 250;
  const padL = 44;
  const padR = 20;
  const padT = 44; // 顶部留白足够放下峰值标注气泡，避免被裁切
  const padB = 34;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const n = daily.length;
  const xAt = (i: number) => padL + (i / Math.max(1, n - 1)) * chartW;
  const yAt = (count: number) => padT + (1 - count / max) * chartH;

  // 平滑曲线路径（Catmull-Rom 转贝塞尔）
  const points = daily.map((d, i) => ({ x: xAt(i), y: yAt(d.count) }));
  let linePath = "";
  points.forEach((p, i) => {
    if (i === 0) {
      linePath = `M ${p.x} ${p.y}`;
    } else {
      const prev = points[i - 1];
      const cx = (prev.x + p.x) / 2;
      linePath += ` C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
    }
  });
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

  // 网格线（4 条水平线）
  const gridLines = [0.25, 0.5, 0.75, 1].map((r) => padT + chartH * (1 - r));

  // 峰值点
  const peakIdx = daily.reduce((mi, d, i) => (d.count > daily[mi].count ? i : mi), 0);
  // 峰值气泡始终显示（含今天为峰值的情况）；今日文字标注仅在峰值不是今天时显示，避免重叠
  const showPeakLabel = daily[peakIdx].count > 0;
  const showTodayLabel = daily[0].count > 0 && peakIdx !== 0;

  // 标注气泡位置（钳制在图表区域内，防止越界裁切）
  const bubbleW = 46;
  const bubbleH = 22;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const bubbleFor = (i: number) => ({
    x: clamp(xAt(i) - bubbleW / 2, 4, W - bubbleW - 4),
    y: clamp(yAt(daily[i].count) - bubbleH - 10, 4, padT + chartH - bubbleH),
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="memory-chart"
      role="img"
      aria-label="未来 30 天每日复习词数曲线"
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e97845" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#e97845" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e97845" />
          <stop offset="100%" stopColor="#f0a07a" />
        </linearGradient>
      </defs>

      {/* 水平网格线 + Y 轴刻度 */}
      {gridLines.map((y, i) => {
        const value = Math.round(max * [0.25, 0.5, 0.75, 1][i]);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eef0f4" strokeWidth="1" strokeDasharray={i === 3 ? "0" : "3 4"} />
            <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#b6bcc7">
              {value}
            </text>
          </g>
        );
      })}
      <text x={padL - 8} y={padT + chartH + 3} textAnchor="end" fontSize="9" fill="#b6bcc7">
        0
      </text>

      {/* 面积填充 */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* 曲线 */}
      <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* 数据点（含原生悬浮提示） */}
      {daily.map((d, i) => {
        const isToday = i === 0;
        if (d.count === 0 && !isToday) return null;
        return (
          <circle
            key={d.date}
            cx={xAt(i)}
            cy={yAt(d.count)}
            r={isToday ? 5 : i === peakIdx ? 4 : 3}
            fill={isToday ? "#e97845" : "#fff"}
            stroke={isToday ? "#fff" : "#e97845"}
            strokeWidth={isToday ? 2.5 : 2}
          >
            <title>{`${d.date} · 复习 ${d.count} 词`}</title>
          </circle>
        );
      })}

      {/* 今日光环 */}
      <circle cx={xAt(0)} cy={yAt(daily[0].count)} r={10} fill="none" stroke="#e97845" strokeOpacity="0.3" strokeWidth="1.5" />

      {/* 峰值数值标注（气泡，位置已钳制不会越界） */}
      {showPeakLabel && (
        <g>
          <rect x={bubbleFor(peakIdx).x} y={bubbleFor(peakIdx).y} width={bubbleW} height={bubbleH} rx="6" fill="#2d4662" />
          <text
            x={bubbleFor(peakIdx).x + bubbleW / 2}
            y={bubbleFor(peakIdx).y + 15}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#fff"
          >
            {daily[peakIdx].count}
          </text>
        </g>
      )}

      {/* 今日数值标注 */}
      {showTodayLabel && (
        <text x={xAt(0)} y={yAt(daily[0].count) - 16} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e97845">
          {daily[0].count}
        </text>
      )}

      {/* X 轴刻度（每 5 天） */}
      {daily.map((d, i) => {
        if (i % 5 !== 0 && i !== n - 1) return null;
        return (
          <text key={d.date} x={xAt(i)} y={H - 10} textAnchor="middle" fontSize="9" fill="#a0a7b3">
            {i === 0 ? "今天" : `+${i}天`}
          </text>
        );
      })}
    </svg>
  );
}

export default function MemoryHome() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError("加载失败，请重试"));
  }, []);

  if (error) return <div className="form-error">{error}</div>;
  if (!data) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Brain size={22} /></div>
        <h2>加载中…</h2>
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">抗遗忘 · 艾宾浩斯遗忘曲线</div>
          <h1>抗遗忘</h1>
          <p>按遗忘规律科学安排复习，把学过的单词真正记牢。</p>
        </div>
      </div>

      {/* 今日待复习卡片 */}
      <section className="memory-hero">
        <div className="memory-hero-left">
          <div className="memory-hero-label">今日待复习</div>
          <div className="memory-hero-count">{data.todayDue}</div>
          <div className="memory-hero-sub">个单词 · 抗遗忘池共 {data.total} 词</div>
        </div>
        <div className="memory-hero-right">
          {data.todayDue > 0 ? (
            <Link href="/dashboard/student/memory/review" className="primary-button memory-start">
              <Play size={16} /> 开始复习
            </Link>
          ) : (
            <div className="memory-done">
              <TrendingUp size={16} /> 今天没有需要复习的单词
            </div>
          )}
        </div>
      </section>

      {/* 遗忘曲线 */}
      <section className="panel-card memory-panel">
        <div className="card-heading">
          <div>
            <h3>未来 30 天复习计划</h3>
            <p>曲线展示每天需要复习的单词数，橙色圆点标记今天，峰值处标注最高复习量。</p>
          </div>
        </div>
        {data.total === 0 ? (
          <div className="empty-inline">
            还没有需要抗遗忘的单词。学后检测中答错的单词会自动进入这里。
          </div>
        ) : (
          <MemoryChart daily={data.daily} />
        )}
      </section>
    </>
  );
}
