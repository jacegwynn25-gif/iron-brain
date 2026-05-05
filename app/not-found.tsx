import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-lg flex-col items-center justify-center space-y-6 px-4 text-center">
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rose-500/80">Error 404</p>
        <h1 className="text-4xl font-black italic tracking-tight text-zinc-100 sm:text-5xl">
          PAGE NOT FOUND
        </h1>
        <p className="text-sm text-zinc-500">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="group inline-flex items-center gap-2 rounded-[1.25rem] bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-4 text-sm font-black italic text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <ArrowLeft className="h-4 w-4 text-white/60 transition-transform group-hover:-translate-x-1" />
        BACK TO DASHBOARD
      </Link>
    </div>
  );
}
