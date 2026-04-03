import { useState, useEffect, useRef } from "react";
import { useUIStore } from "../../stores/uiStore";
import { Timer, X, Zap } from "lucide-react";
import styles from "./SprintTimer.module.css";

interface Props {
  currentWordCount: number;
}

export default function SprintTimer({ currentWordCount }: Props) {
  const {
    sprintActive, sprintStartTime, sprintDuration, sprintGoalWords, sprintStartWordCount,
    startSprint, endSprint,
  } = useUIStore();

  const [showSetup, setShowSetup] = useState(false);
  const [duration, setDuration] = useState(25);
  const [goalWords, setGoalWords] = useState(500);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setupRef = useRef<HTMLDivElement>(null);

  const totalSeconds = sprintDuration * 60;
  const wordsWritten = sprintActive || completed ? Math.max(0, currentWordCount - sprintStartWordCount) : 0;
  const remaining = Math.max(0, totalSeconds - elapsed);
  const goalMet = sprintGoalWords > 0 && wordsWritten >= sprintGoalWords;

  useEffect(() => {
    if (!sprintActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const newElapsed = Math.floor((Date.now() - (sprintStartTime ?? Date.now())) / 1000);
      setElapsed(newElapsed);
      if (newElapsed >= totalSeconds) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setCompleted(true);
        setTimeout(() => {
          endSprint();
          setCompleted(false);
          setElapsed(0);
        }, 6000);
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sprintActive, sprintStartTime, totalSeconds]);

  // Close setup popover on outside click
  useEffect(() => {
    if (!showSetup) return;
    function handleClick(e: MouseEvent) {
      if (setupRef.current && !setupRef.current.contains(e.target as Node)) {
        setShowSetup(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSetup]);

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function handleStart() {
    startSprint(duration, goalWords, currentWordCount);
    setShowSetup(false);
    setElapsed(0);
    setCompleted(false);
  }

  function handleStop() {
    endSprint();
    setElapsed(0);
    setCompleted(false);
  }

  if (sprintActive || completed) {
    return (
      <div className={`${styles.sprintActive} ${goalMet ? styles.goalMet : ""} ${completed ? styles.completed : ""}`}>
        <Timer size={12} className={styles.icon} />
        <span className={styles.timer}>{completed ? "Done!" : formatTime(remaining)}</span>
        <span className={styles.separator}>·</span>
        <span className={styles.words}>+{wordsWritten.toLocaleString()}</span>
        {sprintGoalWords > 0 && (
          <span className={styles.goal}>/{sprintGoalWords.toLocaleString()}</span>
        )}
        {!completed && (
          <button className={styles.stopBtn} onClick={handleStop} title="End sprint">
            <X size={11} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root} ref={setupRef}>
      <button
        className={`${styles.startBtn} ${showSetup ? styles.startBtnActive : ""}`}
        onClick={() => setShowSetup((s) => !s)}
        title="Start a writing sprint"
      >
        <Zap size={13} />
        <span>Sprint</span>
      </button>

      {showSetup && (
        <div className={styles.setup}>
          <div className={styles.setupSection}>
            <span className={styles.setupLabel}>Duration</span>
            <div className={styles.durationRow}>
              {[5, 10, 15, 25, 30].map((d) => (
                <button
                  key={d}
                  className={`${styles.durationBtn} ${duration === d ? styles.durationBtnActive : ""}`}
                  onClick={() => setDuration(d)}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>
          <div className={styles.setupSection}>
            <label className={styles.setupLabel} htmlFor="sprint-goal">
              Word goal
            </label>
            <input
              id="sprint-goal"
              type="number"
              min={0}
              step={50}
              value={goalWords || ""}
              onChange={(e) => setGoalWords(Number(e.target.value))}
              className={styles.goalInput}
              placeholder="optional"
            />
          </div>
          <button className={styles.goBtn} onClick={handleStart}>
            Start Sprint
          </button>
        </div>
      )}
    </div>
  );
}
