/**
 * Jobs (doc 21): open the header's list from anywhere, even when nothing is running.
 * Outside the "AI" group, so Writer mode keeps it for its local work.
 */
import { Activity } from "lucide-react";
import { commandRegistry } from "./registry";
import { useJobsStore } from "../../stores/jobsStore";

commandRegistry.register({
  id: "show-jobs",
  label: "Show jobs",
  keywords: ["jobs", "running", "queue", "queued", "background", "work", "progress", "in flight", "stop"],
  icon: Activity,
  group: "Global",
  action: () => useJobsStore.getState().setOpen(true),
});
