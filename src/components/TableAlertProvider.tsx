"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";

type TableAlertContextValue = {
  /** มีแจ้งเตือนค้างอยู่ (ลูกค้าสั่งของ/เรียกเก็บเงิน) ที่ยังไม่ได้ดู */
  alert: boolean;
  triggerAlert: () => void;
  /** ล้างป้ายแจ้งเตือนเฉยๆ โดยไม่เปลี่ยนหน้า (เช่นเมื่อพนักงานเข้าดูหน้าเปิดโต๊ะเองอยู่แล้ว) */
  clearAlert: () => void;
  /** ให้หน้า "/" สลับไปโหมด "เปิดโต๊ะ" ให้อัตโนมัติรอบเดียวตอนโหลด */
  focusTables: boolean;
  /** กดแจ้งเตือน — ล้างป้าย ตั้งค่าให้ไปโหมดเปิดโต๊ะ แล้วพาไปหน้า "/" */
  goToTables: () => void;
  consumeFocusTables: () => void;
};

const TableAlertContext = createContext<TableAlertContextValue>({
  alert: false,
  triggerAlert: () => {},
  clearAlert: () => {},
  focusTables: false,
  goToTables: () => {},
  consumeFocusTables: () => {},
});

export const useTableAlert = () => useContext(TableAlertContext);

export default function TableAlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [alert, setAlert] = useState(false);
  const [focusTables, setFocusTables] = useState(false);

  const triggerAlert = useCallback(() => setAlert(true), []);
  const clearAlert = useCallback(() => setAlert(false), []);
  const consumeFocusTables = useCallback(() => setFocusTables(false), []);
  const goToTables = useCallback(() => {
    setAlert(false);
    setFocusTables(true);
    router.push("/");
  }, [router]);

  return (
    <TableAlertContext.Provider
      value={{ alert, triggerAlert, clearAlert, focusTables, goToTables, consumeFocusTables }}
    >
      {children}
    </TableAlertContext.Provider>
  );
}
