import { ListContainer, ListRow } from "@/core/ui/list";

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
    <ListContainer className="max-w-2xl">
      {members.map((m) => (
        <ListRow key={m.id}>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{m.full_name || "–"}</span>
            <span className="text-xs text-muted-foreground">{m.email || "–"}</span>
          </div>
          <span className="text-xs text-muted-foreground">{roleLabel(m.role)}</span>
        </ListRow>
      ))}
    </ListContainer>
  );
}
