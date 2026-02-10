export const metadata = {
  title: 'Iron Brain Privacy Policy',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-zinc-500">Legal</p>
      <h1 className="mt-3 text-3xl font-black italic tracking-tight text-zinc-100">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Effective: February 10, 2026</p>

      <div className="mt-8 space-y-6 text-sm text-zinc-300">
        <p>
          Iron Brain (“we”, “us”) collects account details, workout logs, and optional health data you choose to
          connect (for example, Oura Ring). We use this data to calculate training readiness, personalize
          recommendations, and improve the product experience.
        </p>
        <p>
          We do not sell your personal data. Data is only shared with trusted service providers needed to operate
          the app (for example, hosting and analytics), and only as required to provide the service.
        </p>
        <p>
          If you connect a wearable integration, you can disconnect it at any time in Settings. Disconnection stops
          future syncs and clears stored tokens.
        </p>
        <p>
          You can request deletion of your data by contacting us at
          <span className="text-zinc-100"> jacegwynn25@gmail.com</span>.
        </p>
      </div>
    </div>
  );
}
