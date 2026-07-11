import type { AccessPolicy } from "@/features/access/types";
import { ACCESS_MODE_LABELS } from "@/features/access/types";

function summarizeAccess(access: AccessPolicy): string {
  const parts: string[] = [ACCESS_MODE_LABELS[access.mode]];
  if (access.mode === "selected") {
    parts.push(`${access.selectedFolders.length} folders`);
    parts.push(`${access.selectedApplications.length} apps`);
  }
  parts.push(access.voiceEnabled ? "Voice on" : "Voice off");
  return parts.join(" · ");
}

export default function AccessSummaryLine({ access }: { access: AccessPolicy }) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: "var(--k-muted)" }}>{summarizeAccess(access)}</p>
  );
}
