import { publicModels } from "@/lib/models";
import { Studio } from "@/components/Studio";

export default async function VideoPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { start } = await searchParams;
  return <Studio type="video" models={publicModels()} startAssetId={start} />;
}
