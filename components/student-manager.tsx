"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Plus,
  SwitchCamera,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

type Student = {
  id: string;
  name: string;
  username: string;
  createdAt: string;
};

type Invitation = {
  id: string;
  code: string;
  status: string; // ACTIVE | ACCEPTED | REVOKED
  createdAt: string;
  acceptedAt: string | null;
  studentName: string | null;
};

export default function StudentManager({
  students,
  invitations,
}: {
  students: Student[];
  invitations: Invitation[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [unbinding, setUnbinding] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activeInvites = useMemo(
    () => invitations.filter((i) => i.status === "ACTIVE"),
    [invitations],
  );
  const usedInvites = useMemo(
    () => invitations.filter((i) => i.status !== "ACTIVE"),
    [invitations],
  );

  const createInvite = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/invitations", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "生成失败，请重试");
        return;
      }
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // 剪贴板不可用时忽略
    }
  };

  const unbind = async (student: Student) => {
    if (!window.confirm(`确定要解绑学生「${student.name}」吗？解绑后需重新邀请才能绑定。`)) return;
    setUnbinding(student.id);
    setError("");
    try {
      const res = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "解绑失败，请重试");
        return;
      }
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setUnbinding(null);
    }
  };

  const switchTo = async (student: Student) => {
    setSwitching(student.id);
    setError("");
    try {
      const res = await fetch("/api/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "切换失败，请重试");
        return;
      }
      router.push("/dashboard/student/vocabulary");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSwitching(null);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">学生管理</div>
          <h1>学生管理</h1>
          <p>生成邀请码邀请学生加入，管理已绑定的学生关系。</p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      <section className="panel-card invite-card">
        <div className="card-heading">
          <div><h3>邀请学生</h3><p>生成邀请码，学生注册后输入即可与你绑定</p></div>
          <button className="primary-button small" onClick={createInvite} disabled={creating}>
            <Plus size={15} /> {creating ? "生成中…" : "生成邀请码"}
          </button>
        </div>

        {activeInvites.length > 0 && (
          <div className="invite-list">
            {activeInvites.map((inv) => (
              <div className="invite-row" key={inv.id}>
                <div className="invite-code">{inv.code}</div>
                <span className="invite-status">待使用</span>
                <button className="outline-button" onClick={() => copy(inv.code)}>
                  {copied === inv.code ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 复制</>}
                </button>
              </div>
            ))}
          </div>
        )}

        {usedInvites.length > 0 && (
          <div className="invite-history">
            <span className="nav-label">历史邀请</span>
            {usedInvites.map((inv) => (
              <div className="invite-row muted-row" key={inv.id}>
                <div className="invite-code">{inv.code}</div>
                <span className="invite-status">
                  {inv.status === "ACCEPTED" ? `已被 ${inv.studentName ?? "学生"} 使用` : "已失效"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="section-heading" style={{ marginTop: 32 }}>
        <div><h3>已绑定学生</h3><p>共 {students.length} 位学生</p></div>
      </div>

      <section className="panel-card">
        {students.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 220 }}>
            <div className="empty-icon"><Users size={22} /></div>
            <h2>还没有学生</h2>
            <p>生成一个邀请码，邀请学生加入你的学习空间。</p>
          </div>
        ) : (
          students.map((s) => (
            <div className="student-list-row" key={s.id}>
              <div className="student-list-main">
                <div className="avatar orange"><UserRound size={16} /></div>
                <div>
                  <strong>{s.name}</strong>
                  <span>@{s.username} · 加入于 {formatDate(s.createdAt)}</span>
                </div>
              </div>
              <div className="student-list-actions">
                <button className="switch-button" onClick={() => switchTo(s)} disabled={switching === s.id}>
                  <SwitchCamera size={15} /> {switching === s.id ? "切换中…" : "切换"}
                </button>
                <button className="unbind-button" onClick={() => unbind(s)} disabled={unbinding === s.id}>
                  <Trash2 size={15} /> {unbinding === s.id ? "解绑中…" : "解绑"}
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
