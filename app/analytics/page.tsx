import AdvancedAnalyticsDashboard from '../components/AdvancedAnalyticsDashboard';

export const metadata = {
  title: 'Insights | Iron Brain',
  description: 'Science-backed insights into your training'
};

type AnalyticsPageProps = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  return <AdvancedAnalyticsDashboard initialView={resolved?.view} />;
}
