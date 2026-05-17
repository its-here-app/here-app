"use client";

import { useState, useEffect } from "react";
import { BottomPanel } from "../ui/BottomPanel";
import { Button } from "../ui/Button";
import { CityAutocompleteInput } from "../ui/inputs/CityAutocompleteInput";

interface CitySuggestion {
  google_place_id: string;
  display_name: string;
  is_primary?: boolean;
}

interface CityPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (city: CitySuggestion) => void;
}

export default function CityPickerModal({
  isOpen,
  onClose,
  onSelect,
}: CityPickerModalProps) {
  const [city, setCity] = useState("");
  const [cityPlaceId, setCityPlaceId] = useState("");
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCity("");
      setCityPlaceId("");
      setSelectedCity(null);
    }
  }, [isOpen]);

  function handleSwitch() {
    if (selectedCity) {
      onSelect(selectedCity);
      onClose();
    }
  }

  return (
    <BottomPanel
      isOpen={isOpen}
      onClose={onClose}
      header="Explore a new city"
      subheader="Choose where to go next"
      mobileHeight="tall"
      centerBody
      desktopVariant="full-page"
      footer={
        <Button
          variant="filled"
          size="md"
          darkTheme
          softDisabled
          disabled={!cityPlaceId}
          onClick={handleSwitch}
          className="w-full"
        >
          Switch city
        </Button>
      }
      desktopFooter={
        <Button
          variant="filled"
          size="lg"
          darkTheme
          softDisabled
          disabled={!cityPlaceId}
          onClick={handleSwitch}
        >
          Switch city
        </Button>
      }
    >
      <CityAutocompleteInput
        variant="ghost"
        value={city}
        onSelect={(c) => {
          setCity(c.display_name);
          setCityPlaceId(c.google_place_id);
          setSelectedCity(c);
        }}
        onChange={(val) => {
          setCity(val);
          setCityPlaceId("");
          setSelectedCity(null);
        }}
        placeholder="New York"
        autoFocus
        className="lg:-mt-[1.5rem]"
      />
    </BottomPanel>
  );
}
