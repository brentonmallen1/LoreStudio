import { useState } from "react";
import { Globe, MapPin, Zap, Users, Clock, ArrowLeftRight, Calendar } from "lucide-react";
import { useParams } from "react-router-dom";
import LocationManager from "./LocationManager";
import WorldSystemManager from "./WorldSystemManager";
import CultureManager from "./CultureManager";
import HistoryTab from "./HistoryTab";
import TravelDistanceEditor from "./TravelDistanceEditor";
import CalendarEditor from "./CalendarEditor";
import styles from "./WorldBuilding.module.css";

type Tab = "locations" | "systems" | "cultures" | "history" | "travel" | "calendars";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "locations",  label: "Locations",  icon: <MapPin size={13} /> },
  { id: "systems",    label: "Systems",    icon: <Zap size={13} /> },
  { id: "cultures",   label: "Cultures",   icon: <Users size={13} /> },
  { id: "history",    label: "History",    icon: <Clock size={13} /> },
  { id: "travel",     label: "Travel",     icon: <ArrowLeftRight size={13} /> },
  { id: "calendars",  label: "Calendars",  icon: <Calendar size={13} /> },
];

export default function WorldBuildingHub() {
  const { storyId } = useParams<{ storyId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("locations");

  if (!storyId) return null;

  return (
    <div className={styles.hub}>
      <div className={styles.hubHeader}>
        <Globe size={18} color="var(--color-text-muted)" />
        <h1 className={styles.hubTitle}>World Building</h1>
      </div>

      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === "locations"  && <LocationManager storyId={storyId} />}
        {activeTab === "systems"    && <WorldSystemManager storyId={storyId} />}
        {activeTab === "cultures"   && <CultureManager storyId={storyId} />}
        {activeTab === "history"    && <HistoryTab storyId={storyId} />}
        {activeTab === "travel"     && <TravelDistanceEditor storyId={storyId} />}
        {activeTab === "calendars"  && <CalendarEditor storyId={storyId} />}
      </div>
    </div>
  );
}
