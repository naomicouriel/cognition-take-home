import { FeatureFlagDetailView } from "@/apps/feature-flags/DetailView";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <FeatureFlagDetailView id={params.id} />;
}
