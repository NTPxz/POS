"use client";

import { ShieldAlert } from "lucide-react";
import { useProfile } from "@/components/ProfileProvider";
import { hasRole, Role, ROLE_LABELS } from "@/lib/types";

export default function RequireRole({
  min,
  children,
}: {
  min: Role;
  children: React.ReactNode;
}) {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <p className="flex-1 py-16 text-center text-neutral-400">กำลังโหลด...</p>
    );
  }

  if (!profile || !hasRole(profile.role, min)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-neutral-400">
        <ShieldAlert className="h-10 w-10" strokeWidth={1.5} />
        <p>หน้านี้สำหรับ{ROLE_LABELS[min]}ขึ้นไปเท่านั้น</p>
      </div>
    );
  }

  return <>{children}</>;
}
