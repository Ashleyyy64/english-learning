import { Languages, Sparkles } from "lucide-react";

export default function AuthVisual() {
  return (
    <section className="login-visual" aria-label="Lingua 品牌介绍">
      <div className="visual-noise" />
      <div className="brand-lockup light">
        <div className="brand-mark"><Languages size={22} strokeWidth={2.5} /></div>
        <span>lingua</span>
      </div>
      <div className="visual-copy">
        <div className="eyebrow light-eyebrow"><Sparkles size={14} /> 全阶段英语成长空间</div>
        <h1>让每一次<br /><em>学习，都有回应。</em></h1>
        <p>从积累第一个单词，到自信表达自己的观点。<br />Lingua 陪你把英语，变成真正的能力。</p>
      </div>
      <div className="visual-stat-row">
        <div><strong>12,000+</strong><span>精品学习内容</span></div>
        <div><strong>98%</strong><span>学习者持续进步</span></div>
      </div>
      <div className="visual-footer"><span className="status-dot" /> 学习空间现已开放</div>
    </section>
  );
}
