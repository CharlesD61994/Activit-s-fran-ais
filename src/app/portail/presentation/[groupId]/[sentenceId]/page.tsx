import { redirect } from "next/navigation";

export default async function LegacyStudentPresentationPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string; sentenceId: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { groupId, sentenceId } = await params;
  const { plan } = await searchParams;
  const query = new URLSearchParams({ from: "portail" });
  if (plan) query.set("plan", plan);
  const suffix = `?${query.toString()}`;
  redirect(`/presentation/${groupId}/${sentenceId}${suffix}`);
}
