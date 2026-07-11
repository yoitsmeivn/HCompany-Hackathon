import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePageTitle } from "@/app/usePageTitle";
import SessionView from "@/features/live-session/components/SessionView";
import type { Session } from "@/features/sessions/types";
import { getSession } from "@/services/sessions";
import { getComputer } from "@/services/devices";

export default function SessionPage() {
  usePageTitle("Live session");

  const { sessionId } = useParams();
  const [session, setSession] = useState<Session>();
  const [computerName, setComputerName] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    getSession(sessionId).then((s) => {
      if (cancelled) return;
      setSession(s);
      getComputer(s.computerId).then((c) => {
        if (!cancelled) setComputerName(c?.name);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!session) return null;

  return (
    <SessionView
      title={session.name}
      subtitle={`${computerName ?? "…"} · Session #A24-7F`}
    />
  );
}
