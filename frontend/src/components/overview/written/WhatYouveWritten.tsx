import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { proposalsApi } from "../../../api/proposals";
import { toast } from "../../../stores/toastStore";
import NamedHere from "./NamedHere";
import StorySoFar from "./StorySoFar";
import TidyUp from "./TidyUp";
import { useWritten } from "./useWritten";
import styles from "./Written.module.css";

const OPEN_KEY = "ls_written_open";

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * What you've written (doc 29 D6), on the Overview: the discovery writer's view of what is on
 * the page, sorted for them. Open for a story found as it is written; a section the others can
 * open (kept open or shut on this computer). Everything here is read on this computer, with no model,
 * and nothing changes until the writer says so.
 */
export default function WhatYouveWritten({ storyId, discover }: { storyId: string; discover: boolean }) {
  const asked = useLocation().hash === "#written";
  const [opened, setOpened] = useState(readOpen);
  const open = discover || opened || asked;

  const { data, failed, load } = useWritten(storyId, open);
  const [looking, setLooking] = useState(false);

  function toggle() {
    const next = !opened;
    setOpened(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* site data blocked: it stays as chosen until the page is left */
    }
  }

  async function lookForNames() {
    setLooking(true);
    try {
      await proposalsApi.lookAgain(storyId, false);
      await load();
    } catch {
      toast.error("The names could not be read just now. Try again in a moment.");
    } finally {
      setLooking(false);
    }
  }

  // Reached from the palette or a link: open, and in view once it has loaded.
  const loaded = !!data;
  useEffect(() => {
    if (asked && loaded) document.getElementById("written")?.scrollIntoView({ block: "start" });
  }, [asked, loaded]);

  const long = new Set(data?.split_offers.map((o) => o.node_id) ?? []);
  return (
    <section id="written" className={styles.section} aria-labelledby="written-title">
      <header className={styles.head}>
        {discover ? (
          <h2 id="written-title" className={styles.title}>
            What you've written
          </h2>
        ) : (
          <h2 id="written-title" className={styles.title}>
            <button type="button" className={styles.toggle} aria-expanded={open} onClick={toggle}>
              {open ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
              What you've written
            </button>
          </h2>
        )}
        <p className={styles.lead}>
          {discover
            ? "You're finding this story as you write it. Here's what's on the page so far, sorted for you. Nothing changes until you say so."
            : "Your scenes in a line each, who and where your prose names, and offers to tidy up, read from what's on the page."}
        </p>
      </header>
      {open && failed && !data && (
        <p className={styles.quiet} role="alert">
          What you've written did not load.{" "}
          <button type="button" className={styles.secondary} onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      {open && data && (
        <>
          <div className={styles.row}>
            <StorySoFar storyId={storyId} long={long} />
            <TidyUp storyId={storyId} data={data} onChanged={() => void load()} />
          </div>
          <div className={styles.row}>
            <NamedHere
              storyId={storyId}
              kind="person"
              named={data.people}
              fresh={data.new_names.filter((n) => n.kind === "person")}
              onAnswered={() => void load()}
            />
            <NamedHere
              storyId={storyId}
              kind="place"
              named={data.places}
              fresh={data.new_names.filter((n) => n.kind === "place")}
              onAnswered={() => void load()}
            />
          </div>
          <p className={styles.foot}>
            Read from your prose on this computer. New names come from the name scan in{" "}
            <Link to={`/stories/${storyId}/discoveries`} className={styles.link}>
              Discoveries
            </Link>
            {data.last_scan ? "." : ", which hasn't read this story yet."}{" "}
            <button
              type="button"
              className={styles.secondary}
              disabled={looking}
              onClick={() => void lookForNames()}
            >
              {looking ? "Reading…" : data.last_scan ? "Look again" : "Look for new names"}
            </button>
          </p>
        </>
      )}
    </section>
  );
}
