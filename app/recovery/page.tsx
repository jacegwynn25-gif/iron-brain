import { redirect } from 'next/navigation';

export default function RecoveryRedirectPage() {
  redirect('/analytics?view=recovery');
}
