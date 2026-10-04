import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useReloadOnUndo } from "../../../hooks/useUndoRedo";
import { KINDS, type FieldSpec, type LoreKind } from "../../../lib/lorebook/kinds";
import { LORE_KIND, seriesKindsOf } from "../../../lib/series/kinds";
import { useUIStore } from "../../../stores/uiStore";
import type { MenuItem } from "../../common/PopoverMenu";
import WorldBuildingAIPanel from "../../worldbuilding/WorldBuildingAIPanel";
import AssistantRow, { type AssistantAction } from "../AssistantRow";
import ConfirmDelete from "../ConfirmDelete";
import EntitySheet from "../EntitySheet";
import FieldList from "../FieldList";
import LorebookList, { type ListItem } from "../LorebookList";
import { useLoreSelection } from "../useLoreSelection";
import styles from "../Lorebook.module.css";

export interface Named {
  id: string;
}

export interface SimpleSectionConfig<T extends Named> {
  kind: LoreKind;
  /** The section's id under the Lorebook route. */
  section: string;
  /** Change-log entity types whose undo reloads this list. */
  undoTypes: string[];
  load: (storyId: string) => Promise<T[]>;
  create: (storyId: string, name: string, context: { all: T[]; selected: T | null }) => Promise<T>;
  update: (id: string, patch: Partial<T>, entry: T) => Promise<T>;
  remove: (id: string, entry: T) => Promise<unknown>;
  /** Its name, when the record has no `name` of its own (a route is "from ↔ to"). */
  nameOf?: (e: T, all: T[]) => string;
  /** The name is the record's own and can be typed over (default true). */
  renamable?: boolean;
  /** A second kind of record the section adds (history: an era beside its events). */
  secondaryAdd?: { label: string; create: (storyId: string, all: T[]) => Promise<T> };
  /** Create needs something the section lacks (two places for a route): say what, and add nothing. */
  cannotAdd?: () => string | null;
  /** The list row; default: the name and the first short field. */
  row?: (e: T, all: T[]) => Partial<ListItem>;
  /** Override the list entirely (history groups events under eras). */
  rows?: (all: T[]) => ListItem[];
  badges?: (e: T) => ReactNode;
  fields?: (e: T) => FieldSpec[];
  /** What the fields read, when a field is not a plain column (a culture's naming notes). */
  values?: (e: T) => Record<string, unknown>;
  /** The patch a field's edit makes, for those same fields. */
  patchFor?: (key: string, value: string, e: T) => Partial<T>;
  /** More of the main column, under the fields: a tiers editor, the months. */
  extras?: (e: T, save: (patch: Partial<T>) => Promise<unknown>, all: T[]) => ReactNode;
  side?: (e: T, all: T[]) => ReactNode;
  assistant?: (
    e: T,
    storyId: string,
    openAI: ReturnType<typeof useUIStore.getState>["openWorldBuildingAIPanel"],
  ) => AssistantAction[];
  empty: string;
  newName: string;
  addLabel?: string;
  /** The list's heading, when it is not the kind's plural (History holds eras and events). */
  listTitle?: string;
  deleteDetail?: (e: T) => string | undefined;
}

/**
 * A Lorebook section for a kind with no overview of its own (systems, cultures, calendars,
 * travel, history): the list, the first entry open, one sheet. New entries arrive named
 * "New system" with the name ready to type over.
 */
export default function SimpleSection<T extends Named>({ config }: { config: SimpleSectionConfig<T> }) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const { worldBuildingAIPanelOpen, openWorldBuildingAIPanel } = useUIStore();
  const ids = items.map((i) => i.id);
  const { storyId, selectedId, select } = useLoreSelection(config.section, ids, true);
  const spec = KINDS[config.kind];

  const { load } = config;
  const reload = useCallback(
    () =>
      load(storyId).then((rows) => {
        setItems(rows);
        setLoaded(true);
      }),
    [load, storyId],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useReloadOnUndo(config.undoTypes, () => void reload());

  const selected = items.find((i) => i.id === selectedId) ?? null;
  // In a book of a series: which series kinds this list holds, and which one the open entry is.
  const seriesKinds = seriesKindsOf(config.section);
  const selectedLore = (selected as { kind?: string } | null)?.kind ?? config.kind;
  const selectedSeriesKind = seriesKinds.find((k) => LORE_KIND[k] === selectedLore);
  const nameOf = (e: T) =>
    config.nameOf?.(e, items) ?? String((e as unknown as { name?: string }).name ?? "");
  const blocked = config.cannotAdd?.() ?? null;

  async function add() {
    const created = await config.create(storyId, config.newName, { all: items, selected });
    await finishAdd(created);
  }

  async function finishAdd(created: T) {
    setItems((prev) => [...prev, created]);
    setRenaming(created.id);
    select(created.id);
  }

  async function save(patch: Partial<T>) {
    if (!selected) return;
    const updated = await config.update(selected.id, patch, selected);
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  const listItems: ListItem[] = config.rows
    ? config.rows(items)
    : items.map((e) => ({ id: e.id, name: nameOf(e), ...config.row?.(e, items) }));

  const more: MenuItem[] = selected
    ? [
        {
          label: `Delete ${spec.label.toLowerCase()}`,
          icon: Trash2,
          danger: true,
          onSelect: () => setDeleting(selected),
        },
      ]
    : [];

  return (
    <div className={styles.section}>
      <LorebookList
        title={config.listTitle ?? spec.plural}
        items={listItems}
        selectedId={selectedId}
        onSelect={(id) => select(id)}
        onAdd={blocked ? undefined : add}
        addLabel={config.addLabel}
        secondaryAdd={
          config.secondaryAdd && {
            label: config.secondaryAdd.label,
            onClick: async () => finishAdd(await config.secondaryAdd!.create(storyId, items)),
          }
        }
        empty={<p className={styles.listEmpty}>{blocked ?? config.empty}</p>}
        seriesKinds={seriesKinds.length ? seriesKinds : undefined}
        onFromSeries={(id) => void reload().then(() => select(id))}
      />
      <div className={styles.sheetScroll}>
        {selected ? (
          <EntitySheet
            key={selected.id}
            entityKey={selected.id}
            series={selectedSeriesKind && { kind: selectedSeriesKind, id: selected.id }}
            name={nameOf(selected)}
            startRenaming={renaming === selected.id}
            onRename={
              config.renamable === false
                ? undefined
                : (name) => {
                    setRenaming(null);
                    return save({ name } as unknown as Partial<T>);
                  }
            }
            dot={null}
            badges={config.badges?.(selected)}
            more={more}
            side={config.side?.(selected, items)}
            footer={
              config.assistant ? (
                <AssistantRow actions={config.assistant(selected, storyId, openWorldBuildingAIPanel)} />
              ) : null
            }
          >
            <FieldList
              entityKey={selected.id}
              fields={config.fields ? config.fields(selected) : spec.fields}
              values={config.values?.(selected) ?? (selected as unknown as Record<string, unknown>)}
              save={(key, value) =>
                save(config.patchFor?.(key, value, selected) ?? ({ [key]: value } as Partial<T>))
              }
            />
            {config.extras?.(selected, save, items)}
          </EntitySheet>
        ) : (
          loaded && (
            <div className={styles.emptySheet}>
              <p>{blocked ?? config.empty}</p>
            </div>
          )
        )}
      </div>
      {worldBuildingAIPanelOpen && <WorldBuildingAIPanel />}
      {deleting && (
        <ConfirmDelete
          name={nameOf(deleting)}
          detail={config.deleteDetail?.(deleting)}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await config.remove(deleting.id, deleting);
            const rest = items.filter((i) => i.id !== deleting.id);
            setItems(rest);
            select(rest[0]?.id ?? null, { replace: true });
          }}
        />
      )}
    </div>
  );
}
