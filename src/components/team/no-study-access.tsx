import { LogoutButton } from "./logout-button";

export function NoStudyAccess({ title, description, email }: { title: string; description: string; email: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="max-w-md space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">{email}</p>
        <LogoutButton />
      </div>
    </main>
  );
}
