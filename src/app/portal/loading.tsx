export default function Loading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-8 w-56 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-24" />
        ))}
      </div>
      <div className="card h-72" />
    </div>
  );
}
