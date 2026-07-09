"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { createShareLink, revokeShareLink, type ShareLinkActionState } from "./share-link-actions";

const INITIAL_STATE: ShareLinkActionState = { error: null, token: null };

type ShareLink = {
  id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
};

type QuoteResponseRow = {
  action: "angenommen" | "abgelehnt";
  responder_name: string;
  responded_at: string;
  ip_address: string | null;
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("de-DE");
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        const url = `${window.location.origin}/angebot/${token}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Kopiert!" : "Link kopieren"}
    </Button>
  );
}

export function ShareLinkSection({
  quoteId,
  activeLink,
  response,
  canWrite,
}: {
  quoteId: string;
  activeLink: ShareLink | null;
  response: QuoteResponseRow | null;
  canWrite: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(
    createShareLink.bind(null, quoteId),
    INITIAL_STATE,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeShareLink.bind(null, quoteId, activeLink?.id ?? ""),
    INITIAL_STATE,
  );

  const isRevoked = activeLink?.revoked_at != null;
  const isExpired = activeLink ? new Date(activeLink.expires_at) <= new Date() : false;
  const hasUsableLink = activeLink && !isRevoked && !isExpired;

  return (
    <div className="flex flex-col gap-3">
      {response && (
        <p className="text-sm">
          <Badge variant={response.action === "angenommen" ? "success" : "destructive"}>
            {response.action === "angenommen" ? "Angenommen" : "Abgelehnt"}
          </Badge>{" "}
          von {response.responder_name} am {formatDateTime(response.responded_at)}
          {response.ip_address && ` (IP: ${response.ip_address})`}
        </p>
      )}

      {hasUsableLink ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CopyLinkButton token={activeLink.token} />
            {canWrite && (
              <form action={revokeAction}>
                <Button type="submit" variant="destructive" size="sm" disabled={revokePending}>
                  {revokePending ? "…" : "Link widerrufen"}
                </Button>
              </form>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Gültig bis {formatDateTime(activeLink.expires_at)}
            {activeLink.last_viewed_at
              ? ` · zuletzt angesehen am ${formatDateTime(activeLink.last_viewed_at)}`
              : " · noch nicht angesehen"}
          </p>
          <FormMessage error={revokeState.error} success={null} />
        </div>
      ) : canWrite ? (
        <form action={createAction} className="flex flex-wrap items-end gap-2">
          <Field label="Gültig für (Tage)" htmlFor="expiresInDays" className="w-32">
            <Input id="expiresInDays" name="expiresInDays" type="number" min={1} max={365} defaultValue={30} />
          </Field>
          <Button type="submit" size="sm" disabled={createPending}>
            {createPending ? "…" : "Link für Kunden erstellen"}
          </Button>
          <FormMessage error={createState.error} success={null} />
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Kein aktiver Link.</p>
      )}
    </div>
  );
}
