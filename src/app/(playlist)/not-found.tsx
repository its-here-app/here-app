import NotFoundScreen from "@/components/ui/NotFoundScreen";

export default function NotFound() {
  return (
    <NotFoundScreen
      header="Playlist not found"
      message="This playlist doesn't exist or may have been made private."
    />
  );
}
