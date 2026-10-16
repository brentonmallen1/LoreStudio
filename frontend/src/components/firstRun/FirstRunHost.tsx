import { useAuthStore } from "../../stores/authStore";
import { welcomePending } from "../../lib/mode";
import AssistantSetupHost from "../ai/setup/AssistantSetupHost";
import WelcomeDialog from "./WelcomeDialog";

/**
 * What a writer meets before the app is set up for them (doc 30 D4), outside the routes so it
 * stands above Settings and the guides: the welcome question on a new account's first sign-in,
 * and in Studio the gate that shows "Set up the Assistant" until a model answers.
 */
export default function FirstRunHost() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return welcomePending(user.settings) ? <WelcomeDialog /> : <AssistantSetupHost />;
}
