import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const resetScript = `
(function () {
  function clearActiveWorkoutStorage() {
    try {
      var prefixes = [
        'iron_brain_active_session',
        'iron_brain_active_session_v1',
        'iron_brain_session_timestamp',
        'iron_brain_session_version'
      ];
      var keys = [];
      for (var index = 0; index < localStorage.length; index += 1) {
        var key = localStorage.key(index);
        if (!key) continue;
        for (var prefixIndex = 0; prefixIndex < prefixes.length; prefixIndex += 1) {
          if (key === prefixes[prefixIndex] || key.indexOf(prefixes[prefixIndex] + '__') === 0) {
            keys.push(key);
            break;
          }
        }
      }
      for (var removeIndex = 0; removeIndex < keys.length; removeIndex += 1) {
        localStorage.removeItem(keys[removeIndex]);
      }
      sessionStorage.removeItem('iron_brain_active_session_pending');
    } catch (error) {
      // Continue to dashboard even when browser storage is unavailable.
    }
  }

  clearActiveWorkoutStorage();
  window.setTimeout(function () {
    window.location.replace('/?workout_reset=' + Date.now());
  }, 50);
}());
`;

export default function ResetWorkoutPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
      <script dangerouslySetInnerHTML={{ __html: resetScript }} />
      <div className="max-w-sm space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-300">
          Resetting Workout
        </p>
        <h1 className="text-3xl font-black italic tracking-tight text-white">
          Clearing stuck session
        </h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          If you are not redirected automatically, use the button below.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-400 px-5 text-xs font-black uppercase tracking-[0.22em] text-zinc-950"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
