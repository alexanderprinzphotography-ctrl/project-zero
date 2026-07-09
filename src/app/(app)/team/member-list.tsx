import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

function initials(member: Member): string {
  const source = member.full_name?.trim() || member.email || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function MemberList({ members }: { members: Member[] }) {
  return (
    <ListContainer>
      {members.map((m) => (
        <ListRow key={m.id}>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar>
              <AvatarFallback>{initials(m)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{m.full_name || "–"}</span>
              <span className="text-xs text-muted-foreground">{m.email || "–"}</span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{roleLabel(m.role)}</span>
        </ListRow>
      ))}
    </ListContainer>
  );
}
