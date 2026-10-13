import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { systemApi, type ExampleStories } from "../api/system";
import { useStoryStore } from "../stores/storyStore";
import { toast } from "../stores/toastStore";

/** The samples this account does not have yet, and a way to load them (doc 26, P7: Getting
 * started, Settings › Account, the dashboard). The story list is refreshed
 * after loading. */
export function useExampleStories() {
  const [state, setState] = useState<ExampleStories>({ available: false, missing: [] });
  const [adding, setAdding] = useState(false);
  const setStories = useStoryStore((s) => s.setStories);
  // Asked again when the library grows or shrinks: a sample deleted on the dashboard is
  // offered there at once.
  const count = useStoryStore((s) => s.stories.length);

  useEffect(() => {
    systemApi
      .exampleStories()
      .then(setState)
      .catch(() => setState({ available: false, missing: [] }));
  }, [count]);

  const add = useCallback(async () => {
    setAdding(true);
    try {
      const { added, missing } = await systemApi.addExampleStories();
      setState({ available: true, missing });
      setStories(await api.listStories());
      if (added.length === 0) toast.error("The samples could not be loaded.");
      else toast.success(added.length === 1 ? `Loaded "${added[0]}".` : `Loaded ${added.length} samples.`);
    } catch {
      toast.error("The samples could not be loaded.");
    } finally {
      setAdding(false);
    }
  }, [setStories]);

  return {
    canAdd: state.available && state.missing.length > 0,
    missing: state.missing,
    available: state.available,
    adding,
    add,
  };
}
