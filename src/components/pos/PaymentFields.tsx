"use client";

import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { baht, formatNumber } from "@/lib/format";
import { PaymentMethod, PAYMENT_LABELS } from "@/lib/types";

const PAYMENT_ICONS: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  transfer: Smartphone,
  card: CreditCard,
};

const QUICK_CASH = [20, 50, 100, 500, 1000];

export default function PaymentFields({
  total,
  method,
  onMethodChange,
  receivedStr,
  onReceivedChange,
}: {
  total: number;
  method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  receivedStr: string;
  onReceivedChange: (v: string) => void;
}) {
  const received = parseFloat(receivedStr) || 0;
  const change = received - total;

  return (
    <>
      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">วิธีชำระเงิน</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => {
            const Icon = PAYMENT_ICONS[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMethodChange(m)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 font-semibold transition ${
                  method === m
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                {PAYMENT_LABELS[m]}
              </button>
            );
          })}
        </div>
      </div>

      {method === "cash" && (
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">
            รับเงินมา (บาท)
          </p>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            className="input text-right text-lg font-semibold"
            placeholder="0"
            value={receivedStr}
            onChange={(e) => onReceivedChange(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-200"
              onClick={() => onReceivedChange(String(total))}
            >
              พอดี
            </button>
            {QUICK_CASH.filter((v) => v >= total).slice(0, 4).map((v) => (
              <button
                key={v}
                type="button"
                className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-200"
                onClick={() => onReceivedChange(String(v))}
              >
                {formatNumber(v)}
              </button>
            ))}
          </div>
          <div
            className={`mt-3 flex justify-between rounded-xl px-4 py-3 ${
              change >= 0
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            <span className="font-medium">
              {change >= 0 ? "เงินทอน" : "รับเงินยังไม่พอ"}
            </span>
            <span className="text-xl font-bold">
              {baht(Math.abs(Math.max(change, -change)))}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
