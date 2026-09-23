import NotFoundScreen from "@/components/ui/NotFoundScreen";

// Fills the viewport minus the chrome AppShell renders above and below it
// (AppBar + its margin, page top padding, and the bottom padding that reserves
// room for BottomNav). Sizing the box to the leftover space puts the centered
// message at the same optical height as the standalone 404s, which center in a
// full 100dvh. The subtracted total uses the tallest case — logged-in mobile,
// where BottomNav is present — so the page never overflows into a scrollbar.
export default function NotFound() {
  return (
    <NotFoundScreen
      header="Page not found"
      message="The page you're looking for doesn't exist or may have been moved."
      heightClassName="min-h-[calc(100dvh-9.5rem)] lg:min-h-[calc(100dvh-8.25rem)]"
    />
  );
}
