import { createElement } from "react";
import { useState, useEffect, useRef } from "react";
import { Check } from "@/components/ui/icons/Check";
import { toast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { useAuth } from "@/lib/authContext";

export function copyToClipboard(url: string, userId?: string | null) {
  navigator.clipboard.writeText(url).then(() => {
    if (userId) track(userId, "share.link_copied", { url });
    toast({
      icon: createElement(Check, { focus: true }),
      message: "Link copied to clipboard",
    });
  });
}

export function useShare() {
  const [canShare, setCanShare] = useState(false);
  const sharing = useRef(false);
  const { user } = useAuth();

  useEffect(() => {
    setCanShare(!!navigator.share);
  }, []);

  async function share(url: string, title?: string) {
    if (sharing.current) return;
    sharing.current = true;
    try {
      await navigator.share({ title: title ?? document.title, url });
      // Only after the sheet resolves — an AbortError means they backed out,
      // which is not a share.
      if (user) track(user.id, "share.completed", { url });
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") throw err;
    } finally {
      sharing.current = false;
    }
  }

  return { canShare, share };
}
