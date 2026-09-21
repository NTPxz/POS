import AppShell from "@/components/AppShell";
import ProfileProvider from "@/components/ProfileProvider";
import BranchProvider from "@/components/BranchProvider";
import TableAlertProvider from "@/components/TableAlertProvider";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProfileProvider>
      <BranchProvider>
        <TableAlertProvider>
          <AppShell>{children}</AppShell>
        </TableAlertProvider>
      </BranchProvider>
    </ProfileProvider>
  );
}
