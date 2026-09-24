export function PageLoadingState({ label }: Readonly<{ label: string }>) {
  return (
    <main className="app__page-loading" aria-live="polite">
      <p role="status">{label}</p>
    </main>
  );
}
