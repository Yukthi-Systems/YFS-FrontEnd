export function ListSkeleton() {
  return (
    <div className="w-full flex flex-col gap-2 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border-main">
          <div className="w-5 h-5 rounded bg-code-bg" />
          <div className="h-3.5 rounded bg-code-bg flex-1 max-w-xs" />
          <div className="h-3 rounded bg-code-bg w-24 hidden sm:block" />
          <div className="h-3 rounded bg-code-bg w-20 hidden sm:block" />
          <div className="h-3 rounded bg-code-bg w-14" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="bg-code-bg border border-border-main rounded-2xl p-4 h-32" />
      ))}
    </div>
  );
}
