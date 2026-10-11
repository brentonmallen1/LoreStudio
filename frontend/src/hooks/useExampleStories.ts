import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { systemApi, type ExampleStories } from "../api/system";
import { useStoryStore } from "../stores/storyStore";
import { toast } from "../stores/toastStore";

/** The example stories the admin account does not have yet, and a way to add them (the
 * dashboard's empty state, Settings › Account). The story list is refreshed after adding. */
export function useExampleStories() {
  const [state, setState] = useState<ExampleStories>({ available: false, missing: [] });
  const [adding, setAdding] = useState(false);
  const setStories = useStoryStore((s) => s.setStories);

  useEffect(() => {
    systemApi
      .exampleStories()
      .then(setState)
      .catch(() => setState({ available: false, missing: [] }));
  }, []);

  const add = useCallback(async () => {
    setAdding(true);
    try {
      const { added, missing } = await systemApi.addExampleStories();
      setState({ available: true, missing });
      setStories(await api.listStories());
      toast.success(added.length === 1 ? `Added "${added[0]}".` : `Added ${added.length} example stories.`);
    } catch {
      toast.error("The example stories could not be added.");
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
