import { StatusBadge } from "@/components/status-badge";

export function ComingSoon({ title, badge, description }: { title: string; badge: string; description: string }) {
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <StatusBadge tone="info">{badge}</StatusBadge>
      </header>
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{description}</div>
    </div>
  );
}
