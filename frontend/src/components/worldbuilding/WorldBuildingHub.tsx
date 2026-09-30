import { MapPin, Zap, Users, Clock, ArrowLeftRight, Calendar } from "lucide-react";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import { useParams, useLocation } from "react-router-dom";
import LocationManager from "./LocationManager";
import WorldSystemManager from "./WorldSystemManager";
import CultureManager from "./CultureManager";
import HistoryTab from "./HistoryTab";
import TravelDistanceEditor from "./TravelDistanceEditor";
import CalendarEditor from "./CalendarEditor";
import WorldBuildingAIPanel from "./WorldBuildingAIPanel";
import { useUIStore } from "../../stores/uiStore";
import styles from "./WorldBuilding.module.css";

type Tab = "locations" | "systems" | "cultures" | "history" | "travel" | "calendars";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "locations", label: "Locations", icon: <MapPin size={13} /> },
  { id: "systems", label: "Systems", icon: <Zap size={13} /> },
  { id: "cultures", label: "Cultures", icon: <Users size={13} /> },
  { id: "history", label: "History", icon: <Clock size={13} /> },
  { id: "travel", label: "Travel", icon: <ArrowLeftRight size={13} /> },
  { id: "calendars", label: "Calendars", icon: <Calendar size={13} /> },
];

/** The Lorebook section each tab now answers to (doc 12 P1: the tabs became index entries). */
const TAB_FOR_SECTION: Record<string, Tab> = {
  places: "locations",
  systems: "systems",
  cultures: "cultures",
  history: "history",
  travel: "travel",
  calendars: "calendars",
};

/**
 * The world's sections of the Lorebook. Until doc 12 phase 2 gives each its own sheet, one
 * body serves them all, picked by the section in the address.
 */
export default function WorldBuildingHub({ section = "places" }: { section?: string }) {
  const { storyId } = useParams<{ storyId: string }>();
  const { state } = useLocation();
  const selectLocationName: string | undefined = state?.selectLocationName;
  const activeTab = TAB_FOR_SECTION[section] ?? "locations";
  const tab = TABS.find((t) => t.id === activeTab)!;
  const { worldBuildingAIPanelOpen } = useUIStore();

  if (!storyId) return null;

  return (
    <div className={styles.hub}>
      <div className={styles.hubHeader}>
        {tab.icon}
        <h1 className={styles.hubTitle}>{activeTab === "locations" ? "Places" : tab.label}</h1>
        <AIFeatureInfoTrigger pageId="worldbuilding" size="md" />
      </div>

      <div
        className={styles.tabContent}
        style={{ display: "flex", flexDirection: "row", overflow: "hidden" }}
      >
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeTab === "locations" && (
            <LocationManager storyId={storyId} selectLocationName={selectLocationName} />
          )}
          {activeTab === "systems" && <WorldSystemManager storyId={storyId} />}
          {activeTab === "cultures" && <CultureManager storyId={storyId} />}
          {activeTab === "history" && <HistoryTab storyId={storyId} />}
          {activeTab === "travel" && <TravelDistanceEditor storyId={storyId} />}
          {activeTab === "calendars" && <CalendarEditor storyId={storyId} />}
        </div>
        {worldBuildingAIPanelOpen && <WorldBuildingAIPanel />}
      </div>
    </div>
  );
}
