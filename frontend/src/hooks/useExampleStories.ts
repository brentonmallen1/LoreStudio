import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { systemApi, type ExampleStories } from "../api/system";
import { useStoryStore } from "../stores/storyStore";
import { toast } from "../stores/toastStore";

const NONE: ExampleStories = { available: false, missing: [], samples: [] };

/** Every sample, which this account does not have yet, and a way to load one or all of them
 * (doc 26, P7: Getting started, Settings › Account, the dashboard). The story list is refreshed
 * after loading. */
export function useExampleStories() {
  const [state, setState] = useState<ExampleStories>(NONE);
  // What is loading: one sample's title, or "all"; one at a time, so two loads never race.
  const [loading, setLoading] = useState<string | null>(null);
  const setStories = useStoryStore((s) => s.setStories);
  // Asked again when the library grows or shrinks: a sample deleted on the dashboard is
  // offered there at once.
  const count = useStoryStore((s) => s.stories.length);

  useEffect(() => {
    systemApi
      .exampleStories()
      .then(setState)
      .catch(() => setState(NONE));
  }, [count]);

  /** Load one sample (and what it is built on), or every missing one without a title. */
  const add = useCallback(
    async (title?: string) => {
      setLoading(title ?? "all");
      try {
        const { added, ...rest } = await systemApi.addExampleStories(title ? [title] : undefined);
        setState(rest);
        setStories(await api.listStories());
        if (added.length === 0) toast.error("The samples could not be loaded.");
        else toast.success(added.length === 1 ? `Loaded "${added[0]}".` : `Loaded ${added.length} samples.`);
      } catch {
        toast.error("The samples could not be loaded.");
      } finally {
        setLoading(null);
      }
    },
    [setStories],
  );

  return {
    canAdd: state.available && state.missing.length > 0,
    missing: state.missing,
    samples: state.samples,
    available: state.available,
    loading,
    add,
  };
}
