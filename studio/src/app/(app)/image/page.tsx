import { publicModels } from "@/lib/models";
import { Studio } from "@/components/Studio";

export default function ImagePage() {
  return <Studio type="image" models={publicModels()} />;
}
