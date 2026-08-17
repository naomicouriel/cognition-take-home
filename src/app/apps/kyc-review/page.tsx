import { KycReviewView } from "@/apps/kyc-review/View";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <KycReviewView searchParams={searchParams} />;
}
