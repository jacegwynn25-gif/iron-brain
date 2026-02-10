export const metadata = {
  title: 'Iron Brain Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-zinc-500">Legal</p>
      <h1 className="mt-3 text-3xl font-black italic tracking-tight text-zinc-100">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-500">Effective: February 10, 2026</p>

      <div className="mt-8 space-y-6 text-sm text-zinc-300">
        <p>
          Iron Brain provides training planning, logging, and recovery insights. The app is for informational
          purposes only and does not provide medical advice. Always listen to your body and consult a qualified
          professional if you have health concerns.
        </p>
        <p>
          You are responsible for the accuracy of the data you enter or connect. You may disconnect integrations at
          any time from Settings.
        </p>
        <p>
          We may update these terms from time to time. Continued use of the service constitutes acceptance of the
          updated terms.
        </p>
        <p>
          Questions? Contact us at <span className="text-zinc-100">jacegwynn25@gmail.com</span>.
        </p>
      </div>
    </div>
  );
}
