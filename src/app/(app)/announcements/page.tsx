"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Megaphone, RefreshCw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import { Announcement } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

export default function AnnouncementsPage() {
  return (
    <RequireRole min="owner">
      <AnnouncementsPageContent />
    </RequireRole>
  );
}

function AnnouncementsPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setHistory((data as Announcement[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setSendError(null);
    const { error } = await supabase.from("announcements").insert({ message: message.trim() });
    setSending(false);
    if (error) {
      setSendError(`ส่งประกาศไม่สำเร็จ: ${error.message}`);
      return;
    }
    setMessage("");
    setSentMsg("ส่งประกาศเรียบร้อยแล้ว — พนักงานที่เปิดแอปอยู่จะเห็นทันที");
    setTimeout(() => setSentMsg(null), 4000);
    loadData();
  }

  async function handleDelete(a: Announcement) {
    if (!window.confirm("ลบประกาศนี้? (พนักงานที่ยังไม่ได้กดปิดจะไม่เห็นข้อความนี้อีก)")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) {
      window.alert(`ลบไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadData();
  }

  return (
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <h1 className="mb-4 text-xl font-bold md:text-2xl">ประกาศถึงพนักงาน</h1>

      <div className="card mx-auto max-w-lg p-5">
        <div className="mb-3 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-brand-600" strokeWidth={2} />
          <h2 className="font-semibold">พิมพ์ข้อความประกาศ</h2>
        </div>
        <p className="mb-3 text-sm text-neutral-500">
          ข้อความจะขึ้นเป็นกล่องกลางหน้าจอให้พนักงานทุกคนที่เปิดแอปอยู่ทันที (ปิดได้เอง) —
          ใครที่ยังไม่เปิดแอปตอนนี้จะเห็นทันทีที่เปิดแอปครั้งถัดไป
        </p>
        <form onSubmit={send} className="space-y-3">
          <textarea
            className="input min-h-24 resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="เช่น วันนี้ปิดร้านเร็วขึ้น 2 ทุ่ม, ระวังสินค้าหมดสต๊อกก่อนเที่ยง"
            maxLength={500}
            required
          />
          <p className="text-right text-xs text-neutral-400">{message.length}/500</p>
          {sendError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{sendError}</p>
          )}
          {sentMsg && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sentMsg}</p>
          )}
          <button type="submit" className="btn-primary w-full py-3" disabled={sending}>
            {sending ? "กำลังส่ง..." : "ส่งประกาศ"}
          </button>
        </form>
      </div>

      <div className="mx-auto mt-6 max-w-lg">
        <p className="mb-2 text-xs font-semibold uppercase text-neutral-400">ประกาศที่ผ่านมา</p>
        {loading ? (
          <p className="py-10 text-center text-neutral-400">กำลังโหลด...</p>
        ) : loadError ? (
          <div className="py-10 text-center text-red-500">
            <AlertCircle className="mx-auto mb-2 h-8 w-8" strokeWidth={1.5} />
            <p className="mb-3 text-sm">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
            <button className="btn-secondary inline-flex items-center gap-2" onClick={loadData}>
              <RefreshCw className="h-4 w-4" strokeWidth={2} />
              ลองอีกครั้ง
            </button>
          </div>
        ) : history.length === 0 ? (
          <p className="py-10 text-center text-neutral-400">ยังไม่เคยส่งประกาศ</p>
        ) : (
          <ul className="space-y-2">
            {history.map((a) => (
              <li key={a.id} className="card flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words text-sm text-neutral-800">
                    {a.message}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">{formatDateTime(a.created_at)}</p>
                </div>
                <button
                  className="shrink-0 rounded-lg p-2 text-neutral-300 hover:bg-red-50 hover:text-red-500"
                  onClick={() => handleDelete(a)}
                  aria-label="ลบประกาศ"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
