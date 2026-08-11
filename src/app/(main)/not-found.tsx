import EmptyState from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="min-h-[70dvh] flex flex-col items-center justify-center">
      <EmptyState
        className="mt-0"
        header="Page not found"
        message="The page you're looking for doesn't exist or may have been moved."
        actionLabel="Back home"
        actionHref="/"
      />
    </div>
  );
}
