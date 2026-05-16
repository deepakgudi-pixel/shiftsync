export function PayrollLoadingState() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1100px] mx-auto min-h-screen">
      <div className="mb-6 border-b border-zinc-200 pb-5">
        <div className="h-10 w-48 bg-zinc-100 animate-pulse mb-3" />
        <div className="h-4 w-64 bg-zinc-100 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="h-24 bg-zinc-100 animate-pulse border border-zinc-200" />
        ))}
      </div>
    </div>
  )
}
