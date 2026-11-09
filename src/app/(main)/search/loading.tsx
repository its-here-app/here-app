import { Skeleton } from "@/components/ui/Skeleton";

export default function SearchLoading() {
  return (
    <div className="flex flex-col gap-6 -mt-[var(--space-page-md)] pt-[var(--space-page-sm)]">
      <Skeleton className="h-[2.75rem] w-full rounded-[0.75rem]" />
    </div>
  );
}
