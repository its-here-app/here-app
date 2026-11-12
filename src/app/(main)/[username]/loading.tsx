import { Skeleton } from "@/components/ui/Skeleton";
import PlaylistSkeleton from "./PlaylistSkeleton";

// Mirrors <Profile> in src/components/Profile.tsx: each bar sits in a box the
// height of the real text's line box, so nothing shifts when content loads.
function Line({ box, bar }: { box: string; bar: string }) {
  return (
    <div className={`flex items-center ${box}`}>
      <Skeleton className={`rounded-full ${bar}`} />
    </div>
  );
}

export default function ProfileLoading() {
  return (
    <main className="flex flex-col items-center">
      <div className="w-full">
        <div className="flex flex-col items-center w-full">
          <div className="flex flex-col gap-4 items-center w-full lg:flex-row lg:gap-[3.75rem] lg:max-w-145">
            <Skeleton className="size-[6.125rem] shrink-0 rounded-full" />

            <div className="flex flex-col items-center w-full lg:items-start sm:max-w-sm">
              <div className="flex flex-col items-center lg:items-start lg:gap-1">
                <Line box="h-[1.875rem] lg:h-[2.7rem]" bar="h-5 w-36 lg:h-7 lg:w-56" />
                <Line box="hidden lg:flex h-4" bar="h-3 w-24" />
              </div>

              <div className="flex flex-col items-center gap-4 w-full lg:items-start lg:gap-3 lg:mt-3">
                <Line box="h-5" bar="h-3.5 w-56" />
                <Line box="h-4" bar="h-3 w-36" />
              </div>

              <div className="flex gap-2 w-full mt-4 lg:mt-5">
                <Skeleton className="h-9 flex-1 rounded-[0.5rem]" />
              </div>
            </div>
          </div>
        </div>
        <PlaylistSkeleton />
      </div>
    </main>
  );
}
