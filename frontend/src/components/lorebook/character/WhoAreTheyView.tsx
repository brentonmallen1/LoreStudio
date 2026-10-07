import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../../../api/client";
import { useAIAvailable } from "../../../lib/mode";
import { sceneLeaves } from "../../../lib/planning/methods";
import {
  AREA_ORDER,
  AREAS,
  IDENTITY_FIELDS,
  TAKES_FIELDS,
  THINKING_FIELDS,
  newFacet,
  newFormative,
} from "../../../lib/lorebook/whoAreThey";
import { useStoryStore } from "../../../stores/storyStore";
import type { Character, FacetArea } from "../../../types";
import FieldList from "../FieldList";
import BlockHeading from "./BlockHeading";
import { Attributes } from "./CharacterParts";
import { FacetCard, FormativeCard, type EntryContext } from "./EntryCards";
import styles from "./WhoAreThey.module.css";

type Save = (patch: Partial<Character>) => Promise<unknown>;

/**
 * Who are they (doc 20 P6): a character's identity, how they think and take things, their body
 * and mind, and what formed them. Every field optional and in the author's words; nothing here
 * is counted, and none of it is a flaw (D1, D2). Studio passes all of it to the interview and
 * the Assistant unless an entry is kept out.
 */
export default function WhoAreTheyView({
  character,
  save,
  onSaved,
}: {
  character: Character;
  save: Save;
  onSaved: (c: Character) => void;
}) {
  const { characters, structure, activeTemplate, activeStory } = useStoryStore();
  const aiAvailable = useAIAvailable();
  const [research, setResearch] = useState<{ id: string; name: string }[]>([]);
  const storyId = activeStory?.id;
  useEffect(() => {
    if (!storyId) return;
    api
      .listCompendiumEntries(storyId)
      .then((rows) => setResearch(rows.map((r) => ({ id: r.id, name: r.title }))))
      .catch(() => setResearch([]));
  }, [storyId]);

  const ctx: EntryContext = {
    people: characters.filter((c) => c.id !== character.id).map((c) => ({ id: c.id, name: c.name })),
    scenes: sceneLeaves(structure, activeTemplate).map((n) => ({ id: n.id, name: n.title })),
    research,
    aiAvailable,
  };
  const values = character as unknown as Record<string, unknown>;
  const saveField = (key: string, value: string) => save({ [key]: value } as Partial<Character>);

  return (
    <div className={styles.view}>
      <p className={styles.lede}>
        Who they are, in your words. Every field is optional and nothing here is counted or scored.
        {aiAvailable && " The interview and the Assistant use what you write, unless you keep an entry out."}
      </p>

      <section className={styles.block} aria-labelledby="who-identity">
        <BlockHeading id="who-identity" title="Identity" />
        <FieldList
          entityKey={`${character.id}:identity`}
          fields={IDENTITY_FIELDS}
          values={values}
          save={saveField}
        />
      </section>

      <section className={styles.block} aria-labelledby="who-mind">
        <BlockHeading id="who-mind" title="How they think and feel" />
        <FieldList
          entityKey={`${character.id}:thinking`}
          fields={THINKING_FIELDS}
          values={values}
          save={saveField}
        />
        <Attributes character={character} onSaved={onSaved} />
        <h4 className={styles.subHeading}>How they take things</h4>
        <FieldList
          entityKey={`${character.id}:takes`}
          fields={TAKES_FIELDS}
          values={values}
          save={saveField}
        />
      </section>

      <Entries
        title="Body and mind"
        id="who-body"
        hint="A disability, a condition, a way of being: what it shapes, what it does to them, how it shows."
        list={character.facets ?? []}
        save={(facets) => {
          onSaved({ ...character, facets }); // shown at once; the save follows
          return save({ facets });
        }}
        render={(entry, ops, fresh) => (
          <FacetCard
            key={entry.id}
            entry={entry}
            ctx={ctx}
            onChange={(p) => ops.update(entry.id, p)}
            onRemove={() => ops.remove(entry.id)}
            autoFocus={fresh}
          />
        )}
        adder={(add) => <AreaPicker onPick={(area) => add(newFacet(area))} />}
      />

      <Entries
        title="What formed them"
        id="who-formed"
        hint="What happened before or during the story that made them who they are, and what it did to them. A good thing belongs here too."
        list={character.formative ?? []}
        save={(formative) => {
          onSaved({ ...character, formative });
          return save({ formative });
        }}
        render={(entry, ops, fresh) => (
          <FormativeCard
            key={entry.id}
            entry={entry}
            ctx={ctx}
            onChange={(p) => ops.update(entry.id, p)}
            onRemove={() => ops.remove(entry.id)}
            autoFocus={fresh}
          />
        )}
        adder={(add) => (
          <button type="button" className={styles.areaChip} onClick={() => add(newFormative())}>
            <Plus size={11} aria-hidden /> Add a formative experience
          </button>
        )}
      />
    </div>
  );
}

interface Ops<T> {
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
}

/**
 * A list of entries saved whole. The caller shows each change at once (the store first, the
 * save after), so the next edit always starts from the list as it now is.
 */
function Entries<T extends { id: string }>({
  title,
  id,
  hint,
  list,
  save,
  render,
  adder,
}: {
  title: string;
  id: string;
  hint: string;
  list: T[];
  save: (list: T[]) => Promise<unknown>;
  render: (entry: T, ops: Ops<T>, fresh: boolean) => React.ReactNode;
  adder: (add: (entry: T) => void) => React.ReactNode;
}) {
  const [fresh, setFresh] = useState<string | null>(null);
  const commit = (next: T[]) => void save(next);
  const ops: Ops<T> = {
    update: (entryId, patch) => commit(list.map((e) => (e.id === entryId ? { ...e, ...patch } : e))),
    remove: (entryId) => commit(list.filter((e) => e.id !== entryId)),
  };
  return (
    <section className={styles.block} aria-labelledby={id}>
      <BlockHeading id={id} title={title} note={list.length > 0 ? list.length : undefined} />
      {list.length === 0 && <p className={styles.hint}>{hint}</p>}
      <div className={styles.entries}>{list.map((e) => render(e, ops, e.id === fresh))}</div>
      {adder((entry) => {
        setFresh(entry.id);
        commit([...list, entry]);
      })}
    </section>
  );
}

/** Add a Body and mind entry: its area first, so its name can offer that area's words. */
function AreaPicker({ onPick }: { onPick: (area: FacetArea) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className={styles.areaChip} onClick={() => setOpen(true)}>
        <Plus size={11} aria-hidden /> Add to body and mind
      </button>
    );
  }
  return (
    <div className={styles.areaPicker} role="group" aria-label="Which area">
      {AREA_ORDER.map((area) => (
        <button
          key={area}
          type="button"
          className={styles.areaChip}
          onClick={() => {
            setOpen(false);
            onPick(area);
          }}
        >
          {AREAS[area].label}
        </button>
      ))}
      <button type="button" className={styles.areaChip} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
