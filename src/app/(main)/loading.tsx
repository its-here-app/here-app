import { Skeleton } from "@/components/ui/Skeleton";
import { SpotSkeletonList } from "@/components/home/SpotSkeleton";

export default function HomeLoading() {
  return (
    <>
      <div className="hidden lg:flex flex-col mb-4">
        <div className="h-[2.5625rem] flex items-center">
          <Skeleton className="h-4 w-96 rounded-full" />
        </div>
        <div className="h-[2.5625rem] flex items-center">
          <Skeleton className="h-4 w-80 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-12">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-4">
            <Skeleton className="h-4 w-40 rounded-full" />
            <SpotSkeletonList />
          </div>
        ))}
      </div>
    </>
  );
}
