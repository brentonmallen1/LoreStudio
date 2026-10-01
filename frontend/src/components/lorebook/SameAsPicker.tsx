import { MapPin } from "lucide-react";
import { locationsApi } from "../../api/locations";
import { api } from "../../api/client";
import PopoverMenu from "../common/PopoverMenu";
import { useStoryStore } from "../../stores/storyStore";

/**
 * "Same as…" for a place found in the prose (doc 13 P4): pick the place it really is, and
 * its scenes, routes and the places inside it move over, its name stays as an alias, and
 * it goes. One Undo puts it back.
 */
export default function SameAsPicker({
  stubId,
  className,
  onMerged,
}: {
  stubId: string;
  className?: string;
  onMerged?: (intoId: string) => void;
}) {
  const locations = useStoryStore((s) => s.locations);
  const setLocations = useStoryStore((s) => s.setLocations);
  const stub = locations.find((l) => l.id === stubId);
  const others = locations
    .filter((l) => l.id !== stubId && !l.is_stub)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!stub || others.length === 0) return null;
  return (
    <PopoverMenu
      label={`${stub.name} is the same place as…`}
      trigger="Same as…"
      triggerClassName={className}
      align="start"
      items={others.map((l) => ({
        label: l.name,
        icon: MapPin,
        onSelect: async () => {
          await locationsApi.merge(stubId, l.id);
          setLocations(await api.listLocationsFlat(stub.story_id));
          onMerged?.(l.id);
        },
      }))}
    />
  );
}
