export type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "projektleiter":
      return "Projektleiter";
    default:
      return "Mitarbeiter";
  }
}

export function MemberList({ members }: { members: Member[] }) {
  return (
    <table className="w-full max-w-2xl text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="py-2 font-medium">Name</th>
          <th className="py-2 font-medium">E-Mail</th>
          <th className="py-2 font-medium">Rolle</th>
        </tr>
      </thead>
      <tbody>
        {members.map((m) => (
          <tr key={m.id} className="border-b border-border last:border-0">
            <td className="py-2">{m.full_name || "–"}</td>
            <td className="py-2">{m.email || "–"}</td>
            <td className="py-2">{roleLabel(m.role)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
