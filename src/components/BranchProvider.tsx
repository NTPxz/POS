"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Branch } from "@/lib/types";
import { useProfile } from "@/components/ProfileProvider";

const ACTIVE_BRANCH_KEY = "pos-active-branch-id";

type BranchContextValue = {
  branches: Branch[];
  /** สาขาที่กำลังทำงานอยู่ตอนนี้ — พนักงาน/ผู้จัดการล็อกตามสาขาหลักเสมอ
   * เจ้าของร้านสลับเองได้ (ปุ่มสลับสาขา) และค่าที่เลือกจะจำไว้ */
  activeBranchId: string | null;
  canSwitchBranch: boolean;
  setActiveBranchId: (id: string) => void;
  loading: boolean;
};

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  activeBranchId: null,
  canSwitchBranch: false,
  setActiveBranchId: () => {},
  loading: true,
});

export function useBranch() {
  return useContext(BranchContext);
}

export default function BranchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading: profileLoading } = useProfile();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canSwitchBranch = profile?.role === "owner";

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("branches")
      .select("*")
      .order("position")
      .then(({ data }) => {
        setBranches((data as Branch[]) ?? []);
      });
  }, []);

  useEffect(() => {
    if (profileLoading) return;
    if (!profile) {
      setActiveBranchIdState(null);
      setLoading(false);
      return;
    }
    if (profile.role === "owner") {
      const saved =
        typeof window !== "undefined" ? localStorage.getItem(ACTIVE_BRANCH_KEY) : null;
      setActiveBranchIdState(saved || profile.branch_id);
    } else {
      // พนักงาน/ผู้จัดการล็อกตามสาขาหลักเสมอ สลับเองไม่ได้
      setActiveBranchIdState(profile.branch_id);
    }
    setLoading(false);
  }, [profile, profileLoading]);

  const setActiveBranchId = useCallback(
    (id: string) => {
      if (!canSwitchBranch) return;
      setActiveBranchIdState(id);
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_BRANCH_KEY, id);
      }
    },
    [canSwitchBranch]
  );

  return (
    <BranchContext.Provider
      value={{ branches, activeBranchId, canSwitchBranch, setActiveBranchId, loading }}
    >
      {children}
    </BranchContext.Provider>
  );
}
