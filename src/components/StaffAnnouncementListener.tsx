"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import { Announcement } from "@/lib/types";
import { useProfile } from "@/components/ProfileProvider";
import { ANNOUNCEMENT_NOTES, useChime } from "@/lib/chime";

const DISMISSED_KEY = "pos-last-dismissed-announcement";

export default function StaffAnnouncementListener() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const [current, setCurrent] = useState<Announcement | null>(null);
  const { play: playMelody, stop: stopChime } = useChime();

  const showIfUnseen = useCallback(
    (a: Announcement) => {
      const dismissedId = localStorage.getItem(DISMISSED_KEY);
      if (dismissedId !== a.id) {
        setCurrent(a);
        playMelody(ANNOUNCEMENT_NOTES, { repeats: 3 });
      }
    },
    [playMelody]
  );

  useEffect(() => {
    if (!profile) return;

    supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) showIfUnseen(data as Announcement);
      });

    const channel = supabase
      .channel("staff-announcements")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => {
          showIfUnseen(payload.new as Announcement);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, supabase, showIfUnseen]);

  function dismiss() {
    stopChime();
    if (current) localStorage.setItem(DISMISSED_KEY, current.id);
    setCurrent(null);
  }

  if (!profile || !current) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
          <Megaphone className="h-7 w-7 text-brand-600" strokeWidth={2} />
        </div>
        <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">
          ประกาศจากเจ้าของร้าน
        </p>
        <p className="whitespace-pre-wrap break-words text-lg font-medium text-neutral-800">
          {current.message}
        </p>
        <p className="mt-3 text-xs text-neutral-400">{formatDateTime(current.created_at)}</p>
        <button className="btn-primary mt-5 w-full py-3" onClick={dismiss}>
          <X className="mr-1.5 inline h-4 w-4" strokeWidth={2.5} />
          รับทราบ / ปิด
        </button>
      </div>
    </div>
  );
}
