import { Skeleton } from "@/components/ui/Skeleton";
import { SpotSkeletonList } from "@/components/home/SpotSkeleton";

export default function SavesLoading() {
  return (
    <main className="flex min-h-screen flex-col">
      <Skeleton className="h-[2.75rem] w-full rounded-[0.75rem] mb-4" />
      <Skeleton className="h-[1em] w-20 rounded-full py-1 mb-4" />
      <SpotSkeletonList />
    </main>
  );
}
