"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./authContext";
import { getSavedSpots, saveSpot, unsaveSpot } from "@/lib/services/saves";
import type { Spot, DraftSpot, SaveOrigin } from "@/types";

interface SavesContextType {
  savedSpots: Spot[];
  isSaved: (googlePlaceId: string) => boolean;
  toggle: (spot: DraftSpot, origin: SaveOrigin) => Promise<void>;
  addSpot: (spot: DraftSpot, origin: SaveOrigin) => Promise<void>;
  removeSpot: (spot: Spot) => Promise<void>;
  optimisticRemove: (googlePlaceId: string) => void;
  restoreSpot: (spot: Spot) => void;
  loading: boolean;
  error: string | null;
}

const SavesContext = createContext<SavesContextType>({
  savedSpots: [],
  isSaved: () => false,
  toggle: async () => {},
  addSpot: async () => {},
  removeSpot: async () => {},
  optimisticRemove: () => {},
  restoreSpot: () => {},
  loading: true,
  error: null,
});

export function SavesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [savedSpots, setSavedSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSavedSpots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getSavedSpots(user.id).then((spots) => {
      setSavedSpots(spots);
      setLoading(false);
    });
  }, [user]);

  const isSaved = useCallback(
    (googlePlaceId: string) =>
      savedSpots.some((s) => s.google_place_id === googlePlaceId),
    [savedSpots]
  );

  const addSpot = useCallback(
    async (draft: DraftSpot, origin: SaveOrigin) => {
      if (!user) return;
      setError(null);
      try {
        const newSpot = await saveSpot(
          user.id,
          {
            spot_id: draft.google_place_id,
            name: draft.name,
            address: draft.address,
            photo_url: draft.photo_url,
            rating: draft.rating,
            types: draft.types,
          },
          origin
        );
        setSavedSpots((prev) => [newSpot, ...prev]);
      } catch (e) {
        console.error("saveSpot failed:", e);
        setError(String(e));
      }
    },
    [user]
  );

  const removeSpot = useCallback(
    async (existing: Spot) => {
      if (!user) return;
      setError(null);
      setSavedSpots((prev) => prev.filter((s) => s.id !== existing.id));
      try {
        await unsaveSpot(user.id, existing.id);
      } catch (e) {
        console.error("unsaveSpot failed:", e);
        setError(String(e));
        setSavedSpots((prev) => [existing, ...prev]);
      }
    },
    [user]
  );

  const toggle = useCallback(
    async (draft: DraftSpot, origin: SaveOrigin) => {
      const existing = savedSpots.find(
        (s) => s.google_place_id === draft.google_place_id
      );
      if (existing) await removeSpot(existing);
      else await addSpot(draft, origin);
    },
    [savedSpots, removeSpot, addSpot]
  );

  const optimisticRemove = useCallback((googlePlaceId: string) => {
    setSavedSpots((prev) => prev.filter((s) => s.google_place_id !== googlePlaceId));
  }, []);

  const restoreSpot = useCallback((spot: Spot) => {
    setSavedSpots((prev) => [spot, ...prev.filter((s) => s.id !== spot.id)]);
  }, []);

  return (
    <SavesContext.Provider value={{ savedSpots, isSaved, toggle, addSpot, removeSpot, optimisticRemove, restoreSpot, loading, error }}>
      {children}
    </SavesContext.Provider>
  );
}

export function useSaves() {
  return useContext(SavesContext);
}
