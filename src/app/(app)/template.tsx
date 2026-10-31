// ใช้แค่ opacity เท่านั้น เพราะ transform จะทำให้ modal แบบ position: fixed ข้างในเลื่อนตาม
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-fade h-full">{children}</div>;
}
