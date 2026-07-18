import AppShell from "@/components/AppShell";
import ProfileProvider from "@/components/ProfileProvider";
import TableAlertProvider from "@/components/TableAlertProvider";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProfileProvider>
      <TableAlertProvider>
        <AppShell>{children}</AppShell>
      </TableAlertProvider>
    </ProfileProvider>
  );
}
