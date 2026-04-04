import { Outlet } from "react-router-dom";
import GlobalHeader from "./GlobalHeader";
import { useUIStore } from "../../stores/uiStore";
import styles from "./GlobalLayout.module.css";

export default function GlobalLayout() {
  const { viewState } = useUIStore();
  const isFocused = viewState !== "normal";

  return (
    <div className={styles.shell}>
      <GlobalHeader />
      <div className={`${styles.content} ${isFocused ? styles.contentFocused : styles.contentNormal}`}>
        <Outlet />
      </div>
    </div>
  );
}
