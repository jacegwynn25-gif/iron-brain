export default function AppLoading() {
  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(55rem 55rem at 14% 8%, rgba(148,163,184,0.11), transparent 45%), radial-gradient(50rem 50rem at 88% 10%, rgba(59,130,246,0.08), transparent 45%), radial-gradient(40rem 40rem at 55% 92%, rgba(34,197,94,0.07), transparent 50%)',
        }}
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-2xl items-center justify-center px-6">
        <div className="w-full max-w-xs">
          <p className="text-center text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">Loading</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="h-1.5 rounded-full bg-cyan-400/70 animate-pulse" />
            <div className="h-1.5 rounded-full bg-blue-400/70 animate-pulse [animation-delay:120ms]" />
            <div className="h-1.5 rounded-full bg-emerald-400/70 animate-pulse [animation-delay:240ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
