import { bookList, elementForRow, useSeriesStore } from "../../stores/seriesStore";
import { toast } from "../../stores/toastStore";

/**
 * Before a copy of shared research is deleted in one book (v1.5): what to say after, since
 * the other books keep theirs. Returns a function to call once it is gone; nothing to say
 * for research this book does not share.
 */
export function onSharedDelete(refId: string, name: string): () => void {
  const { series, storyId } = useSeriesStore.getState();
  const element = storyId ? elementForRow(series, storyId, refId) : null;
  const others = element?.members.filter((m) => m.story_id !== storyId) ?? [];
  return () => {
    if (others.length === 0) return;
    toast.success(`Deleted from this book. ${name} is still in ${bookList(others.map((m) => m.position))}.`);
    void useSeriesStore.getState().refetch();
  };
}
