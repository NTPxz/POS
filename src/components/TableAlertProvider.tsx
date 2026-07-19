"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";

type TableAlertContextValue = {
  /** มีแจ้งเตือนค้างอยู่ (ลูกค้าสั่งของ/เรียกเก็บเงิน) ที่ยังไม่ได้ดู */
  alert: boolean;
  /** โต๊ะล่าสุดที่ทำให้เกิดแจ้งเตือน — ใช้ตอนกดจุดแดงบน nav เฉยๆ (ไม่ได้กดผ่าน toast ที่รู้โต๊ะอยู่แล้ว) */
  alertTableId: string | null;
  triggerAlert: (tableId?: string) => void;
  /** ล้างป้ายแจ้งเตือนเฉยๆ โดยไม่เปลี่ยนหน้า (เช่นเมื่อพนักงานเข้าดูหน้าเปิดโต๊ะเองอยู่แล้ว) */
  clearAlert: () => void;
  /** ให้หน้า "/" สลับไปโหมด "เปิดโต๊ะ" ให้อัตโนมัติรอบเดียวตอนโหลด */
  focusTables: boolean;
  /** โต๊ะที่ต้องเปิดเข้าไปดูตรงๆ ทันที (มาจากการกด toast/badge ของโต๊ะนั้นเจาะจง) */
  focusTableId: string | null;
  /** กดแจ้งเตือน — ล้างป้าย ตั้งค่าให้ไปโหมดเปิดโต๊ะ แล้วพาไปหน้า "/" ระบุ tableId ถ้าจะให้เปิดโต๊ะนั้นตรงๆ เลย */
  goToTables: (tableId?: string) => void;
  consumeFocusTables: () => void;
  /** ให้ TablesView เรียกหลังจากเปิดโต๊ะตาม focusTableId ให้แล้ว จะได้ไม่เปิดซ้ำ */
  consumeFocusTableId: () => void;
};

const TableAlertContext = createContext<TableAlertContextValue>({
  alert: false,
  alertTableId: null,
  triggerAlert: () => {},
  clearAlert: () => {},
  focusTables: false,
  focusTableId: null,
  goToTables: () => {},
  consumeFocusTables: () => {},
  consumeFocusTableId: () => {},
});

export const useTableAlert = () => useContext(TableAlertContext);

export default function TableAlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [alert, setAlert] = useState(false);
  const [alertTableId, setAlertTableId] = useState<string | null>(null);
  const [focusTables, setFocusTables] = useState(false);
  const [focusTableId, setFocusTableId] = useState<string | null>(null);

  const triggerAlert = useCallback((tableId?: string) => {
    setAlert(true);
    if (tableId) setAlertTableId(tableId);
  }, []);
  const clearAlert = useCallback(() => {
    setAlert(false);
    setAlertTableId(null);
  }, []);
  const consumeFocusTables = useCallback(() => setFocusTables(false), []);
  const consumeFocusTableId = useCallback(() => setFocusTableId(null), []);
  const goToTables = useCallback(
    (tableId?: string) => {
      setAlert(false);
      setAlertTableId(null);
      setFocusTables(true);
      setFocusTableId(tableId ?? null);
      router.push("/");
    },
    [router]
  );

  return (
    <TableAlertContext.Provider
      value={{
        alert,
        alertTableId,
        triggerAlert,
        clearAlert,
        focusTables,
        focusTableId,
        goToTables,
        consumeFocusTables,
        consumeFocusTableId,
      }}
    >
      {children}
    </TableAlertContext.Provider>
  );
}
