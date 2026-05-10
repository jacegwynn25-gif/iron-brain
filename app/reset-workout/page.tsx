import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const resetScript = `
(function () {
  var params = new URLSearchParams(window.location.search);
  var hardReset = params.get('hard') === '1';

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

  function clearBrowserCaches() {
    var tasks = [];

    try {
      if ('caches' in window) {
        tasks.push(
          caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) { return caches.delete(key); }));
          })
        );
      }
    } catch (error) {
      // Cache storage may be unavailable in some webviews.
    }

    try {
      if ('serviceWorker' in navigator) {
        tasks.push(
          navigator.serviceWorker.getRegistrations().then(function (registrations) {
            return Promise.all(registrations.map(function (registration) {
              return registration.unregister();
            }));
          })
        );
      }
    } catch (error) {
      // Service worker access may be blocked in standalone mode.
    }

    return Promise.allSettled(tasks);
  }

  clearActiveWorkoutStorage();
  (hardReset ? clearBrowserCaches() : Promise.resolve()).finally(function () {
    window.setTimeout(function () {
      window.location.replace('/?workout_reset=' + Date.now() + (hardReset ? '&hard=1' : ''));
    }, 80);
  });
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
        <div className="grid gap-2">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-400 px-5 text-xs font-black uppercase tracking-[0.22em] text-zinc-950"
          >
            Go Home
          </Link>
          <Link
            href="/reset-workout?hard=1"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 px-5 text-xs font-black uppercase tracking-[0.18em] text-zinc-300"
          >
            Hard Reset App Cache
          </Link>
        </div>
      </div>
    </main>
  );
}
