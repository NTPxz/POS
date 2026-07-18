import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

type PushPayload = {
  type: "order" | "bill";
  table_name?: string;
  product_name?: string;
  quantity?: number;
};

function buildNotification(payload: PushPayload) {
  const tableName = payload.table_name || "โต๊ะ";
  if (payload.type === "bill") {
    return {
      title: `เรียกเก็บเงิน • ${tableName}`,
      body: "ลูกค้าพร้อมจ่ายแล้ว",
      tag: "pos-bill",
    };
  }
  return {
    title: `ลูกค้าสั่งอาหาร • ${tableName}`,
    body: payload.quantity
      ? `${payload.product_name ?? "สินค้า"} x${payload.quantity}`
      : payload.product_name ?? "มีออเดอร์ใหม่",
    tag: "pos-order",
  };
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-push-secret");
  if (!secret || secret !== process.env.PUSH_TRIGGER_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return NextResponse.json({ error: "push ยังไม่ได้ตั้งค่า VAPID" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const payload = (await request.json().catch(() => null)) as PushPayload | null;
  if (!payload?.type) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const notification = buildNotification(payload);
  const staleIds: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(notification)
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return NextResponse.json({ sent, removed: staleIds.length });
}
