export function ChannelCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="skeleton w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
          <div className="skeleton h-3 w-full rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
      </div>
      <div className="skeleton h-9 rounded-xl" />
    </div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className="skeleton aspect-video" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

export function ChannelHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 p-6">
      <div className="skeleton w-20 h-20 rounded-full flex-shrink-0" />
      <div className="space-y-2 flex-1">
        <div className="skeleton h-6 w-48 rounded" />
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
    </div>
  );
}
