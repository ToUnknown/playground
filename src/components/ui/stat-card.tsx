import { Panel } from "@/components/ui/panel";

export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <Panel className="stat-card">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      {note ? <p>{note}</p> : null}
    </Panel>
  );
}
