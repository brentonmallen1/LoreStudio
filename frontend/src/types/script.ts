/* A screenplay's export and its printed pages (doc 25, P3). Kept out of index.ts (size budget). */

/** A screenplay's own export formats (doc 25, P3). */
export type ScriptExportFormat = "screenplay_pdf" | "fdx" | "fountain";

/** The choices a script export offers; the preview draws with the same ones. */
export interface ScriptExportChoices {
  title_page: boolean;
  scene_numbers: boolean;
  bold_headings: boolean;
  page_size: "letter" | "a4";
  auto_contd: boolean;
}

/** One printed line of a script page, in points from the page's top left (`script_pdf.Item`). */
export interface ScriptLine {
  top: number;
  left: number;
  text: string;
  kind: "" | "bold" | "italic" | "centre";
}

/** A screenplay's pages exactly as the PDF prints them (GET /stories/{id}/script-layout). */
export interface ScriptLayout {
  width_pt: number;
  height_pt: number;
  pages: ScriptLine[][];
  page_count: number;
}

/** What a script's title page says beyond the title and byline. */
export interface TitlePage {
  credit: string;
  based_on: string;
  contact: string;
  draft: string;
  date: string;
}

/** A manuscript export's choices: prose formats and a screenplay's own. */
export interface ExportOptions extends Partial<ScriptExportChoices> {
  format:
    "docx" | "docx_manuscript" | "epub" | "markdown" | "html" | "odt" | "pdf" | "txt" | ScriptExportFormat;
  include_headers: boolean;
  include_scene_titles: boolean;
  title_page: boolean;
  scene_break: string;
  status_filter: string[] | null;
  pdf_layout?: "default" | "novel" | "manuscript" | "compact" | "dark";
}
