"use client";

import { useCallback, useEffect, useRef } from "react";

export type ChimeNote = { freq: number; dur: number };

// ทำนองแจ้งเตือน — เพลงสั้นๆ วนซ้ำจนยาวรวม ~10 วิ ให้ได้ยินชัดในร้านที่มีเสียงดัง
export const ORDER_NOTES: ChimeNote[] = [
  { freq: 523.25, dur: 0.24 }, // C5
  { freq: 659.25, dur: 0.24 }, // E5
  { freq: 783.99, dur: 0.24 }, // G5
  { freq: 1046.5, dur: 0.24 }, // C6
  { freq: 783.99, dur: 0.24 }, // G5
  { freq: 659.25, dur: 0.24 }, // E5
  { freq: 783.99, dur: 0.24 }, // G5
  { freq: 1046.5, dur: 0.5 }, // C6 (โน้ตยาวปิดท้าย)
];
export const BILL_NOTES: ChimeNote[] = [
  { freq: 880, dur: 0.23 },
  { freq: 659.25, dur: 0.23 },
  { freq: 880, dur: 0.23 },
  { freq: 659.25, dur: 0.23 },
  { freq: 880, dur: 0.23 },
  { freq: 659.25, dur: 0.23 },
  { freq: 880, dur: 0.23 },
  { freq: 659.25, dur: 0.5 },
];
// ทำนองประกาศ — เสียงต่างจากออเดอร์/เรียกเก็บเงิน ให้แยกออกด้วยหู
export const ANNOUNCEMENT_NOTES: ChimeNote[] = [
  { freq: 659.25, dur: 0.2 }, // E5
  { freq: 783.99, dur: 0.2 }, // G5
  { freq: 987.77, dur: 0.45 }, // B5 (โน้ตยาวปิดท้าย)
];

type PlayOptions = {
  repeats?: number;
  gainPeak?: number;
  gap?: number;
};

/**
 * เล่นทำนองแจ้งเตือนผ่าน Web Audio API (สังเคราะห์เอง ไม่ต้องใช้ไฟล์เสียง)
 * แชร์ audio context เดียวกันทั้งแอป และ unlock ตั้งแต่ user gesture แรก
 * กันเบราว์เซอร์บล็อก autoplay
 */
export function useChime() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    function unlock() {
      if (!audioCtxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      audioCtxRef.current?.resume().catch(() => {});
    }
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  return useCallback((notes: ChimeNote[], opts?: PlayOptions) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const repeats = opts?.repeats ?? 4;
      const gainPeak = opts?.gainPeak ?? 0.65;
      const gap = opts?.gap ?? 0.3;
      const cycleDur = notes.reduce((sum, n) => sum + n.dur, 0) + 0.02 * notes.length;

      const now = ctx.currentTime;
      for (let rep = 0; rep < repeats; rep++) {
        let t = now + rep * (cycleDur + gap);
        for (const note of notes) {
          const start = t;
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = note.freq;
          gainNode.gain.setValueAtTime(0.0001, start);
          gainNode.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + note.dur + 0.02);
          t += note.dur + 0.02;
        }
      }
    } catch {
      // เบราว์เซอร์บางตัวอาจบล็อกก่อน user gesture — ไม่ใช่ error ร้ายแรง ปล่อยผ่าน
    }
  }, []);
}
