export function NoAccess({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border bg-muted/40 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
