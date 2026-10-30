import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ร่มโพธิ์ - ระบบขายหน้าร้าน",
};

export default function RomphoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
