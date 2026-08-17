import { FeatureFlagsView } from "@/apps/feature-flags/View";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <FeatureFlagsView searchParams={searchParams} />;
}
