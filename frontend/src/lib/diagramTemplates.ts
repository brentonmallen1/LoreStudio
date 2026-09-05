import type { DiagramNode, DiagramEdge } from "../types";

export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  type: "mindmap" | "flowchart";
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    id: "three-act",
    name: "Three-Act Structure",
    description: "Classic setup → confrontation → resolution",
    type: "flowchart",
    nodes: [
      {
        id: "act1",
        type: "central",
        position: { x: 60, y: 180 },
        data: { label: "Act I\nSetup", color: "#4a7fa3" },
      },
      {
        id: "inc",
        type: "mindmap",
        position: { x: 280, y: 100 },
        data: { label: "Inciting Incident", color: "#6a7a3a" },
      },
      {
        id: "act2",
        type: "central",
        position: { x: 420, y: 180 },
        data: { label: "Act II\nConfrontation", color: "#a88a2a" },
      },
      {
        id: "mid",
        type: "mindmap",
        position: { x: 580, y: 80 },
        data: { label: "Midpoint", color: "#6a7a3a" },
      },
      {
        id: "low",
        type: "mindmap",
        position: { x: 580, y: 280 },
        data: { label: "Dark Moment", color: "#a84a4a" },
      },
      {
        id: "act3",
        type: "central",
        position: { x: 760, y: 180 },
        data: { label: "Act III\nResolution", color: "#6a8a4a" },
      },
      {
        id: "clim",
        type: "mindmap",
        position: { x: 940, y: 100 },
        data: { label: "Climax", color: "#a84a4a" },
      },
      {
        id: "res",
        type: "mindmap",
        position: { x: 940, y: 260 },
        data: { label: "Resolution", color: "#6a8a4a" },
      },
    ],
    edges: [
      { id: "e1", source: "act1", target: "inc", animated: true },
      { id: "e2", source: "inc", target: "act2", animated: true },
      { id: "e3", source: "act2", target: "mid", animated: false },
      { id: "e4", source: "act2", target: "low", animated: false },
      { id: "e5", source: "mid", target: "act3", animated: true },
      { id: "e6", source: "low", target: "act3", animated: true },
      { id: "e7", source: "act3", target: "clim", animated: false },
      { id: "e8", source: "act3", target: "res", animated: false },
    ],
  },
  {
    id: "character-web",
    name: "Character Relationship Web",
    description: "Central protagonist with supporting cast",
    type: "mindmap",
    nodes: [
      {
        id: "proto",
        type: "central",
        position: { x: 380, y: 240 },
        data: { label: "Protagonist", color: "#c26a3a" },
      },
      {
        id: "antag",
        type: "mindmap",
        position: { x: 660, y: 160 },
        data: { label: "Antagonist", color: "#a84a4a" },
      },
      {
        id: "mentor",
        type: "mindmap",
        position: { x: 100, y: 100 },
        data: { label: "Mentor", color: "#4a7fa3" },
      },
      {
        id: "ally1",
        type: "mindmap",
        position: { x: 120, y: 360 },
        data: { label: "Ally", color: "#6a8a4a" },
      },
      {
        id: "love",
        type: "mindmap",
        position: { x: 400, y: 440 },
        data: { label: "Love Interest", color: "#8b6aa8" },
      },
      {
        id: "trickster",
        type: "mindmap",
        position: { x: 650, y: 380 },
        data: { label: "Trickster", color: "#a88a2a" },
      },
    ],
    edges: [
      { id: "r1", source: "proto", target: "antag", label: "conflict" },
      { id: "r2", source: "mentor", target: "proto", label: "guides" },
      { id: "r3", source: "proto", target: "ally1", label: "trusts" },
      { id: "r4", source: "proto", target: "love", label: "loves" },
      { id: "r5", source: "trickster", target: "proto", label: "challenges" },
    ],
  },
  {
    id: "plot-timeline",
    name: "Plot Timeline",
    description: "Linear sequence of key story events",
    type: "flowchart",
    nodes: [
      { id: "e1", type: "mindmap", position: { x: 60, y: 200 }, data: { label: "Opening" } },
      { id: "e2", type: "mindmap", position: { x: 240, y: 200 }, data: { label: "Event 2" } },
      { id: "e3", type: "mindmap", position: { x: 420, y: 200 }, data: { label: "Event 3" } },
      { id: "e4", type: "mindmap", position: { x: 600, y: 200 }, data: { label: "Event 4" } },
      { id: "e5", type: "mindmap", position: { x: 780, y: 200 }, data: { label: "Ending" } },
    ],
    edges: [
      { id: "t1", source: "e1", target: "e2", animated: true },
      { id: "t2", source: "e2", target: "e3", animated: true },
      { id: "t3", source: "e3", target: "e4", animated: true },
      { id: "t4", source: "e4", target: "e5", animated: true },
    ],
  },
  {
    id: "mystery-clue-map",
    name: "Mystery Clue Map",
    description: "Central mystery with suspects, clues, and red herrings",
    type: "mindmap",
    nodes: [
      {
        id: "mystery",
        type: "central",
        position: { x: 360, y: 220 },
        data: { label: "The Mystery", color: "#a84a4a" },
      },
      {
        id: "truth",
        type: "central",
        position: { x: 700, y: 100 },
        data: { label: "The Truth", color: "#6a8a4a" },
      },
      {
        id: "s1",
        type: "mindmap",
        position: { x: 80, y: 80 },
        data: { label: "Suspect A", color: "#c26a3a" },
      },
      {
        id: "s2",
        type: "mindmap",
        position: { x: 80, y: 360 },
        data: { label: "Suspect B", color: "#c26a3a" },
      },
      {
        id: "clue1",
        type: "mindmap",
        position: { x: 200, y: 220 },
        data: { label: "Clue", color: "#8b6aa8" },
      },
      {
        id: "red1",
        type: "mindmap",
        position: { x: 550, y: 360 },
        data: { label: "Red Herring", color: "#a88a2a" },
      },
      {
        id: "wit",
        type: "mindmap",
        position: { x: 600, y: 280 },
        data: { label: "Witness", color: "#4a7fa3" },
      },
    ],
    edges: [
      { id: "m1", source: "s1", target: "mystery", label: "suspect" },
      { id: "m2", source: "s2", target: "mystery", label: "suspect" },
      { id: "m3", source: "clue1", target: "mystery", label: "points to" },
      { id: "m4", source: "clue1", target: "truth", label: "reveals" },
      { id: "m5", source: "red1", target: "mystery", label: "misleads" },
      { id: "m6", source: "wit", target: "truth", label: "knows" },
    ],
  },
  {
    id: "subplot-tracker",
    name: "Subplot Tracker",
    description: "Main plot with parallel subplots and intersections",
    type: "mindmap",
    nodes: [
      {
        id: "main",
        type: "central",
        position: { x: 360, y: 220 },
        data: { label: "Main Plot", color: "#c26a3a" },
      },
      {
        id: "sub1",
        type: "central",
        position: { x: 100, y: 100 },
        data: { label: "Subplot A", color: "#4a7fa3" },
      },
      {
        id: "sub2",
        type: "central",
        position: { x: 100, y: 340 },
        data: { label: "Subplot B", color: "#8b6aa8" },
      },
      {
        id: "cross1",
        type: "mindmap",
        position: { x: 560, y: 140 },
        data: { label: "Intersection", color: "#6a7a3a" },
      },
      {
        id: "cross2",
        type: "mindmap",
        position: { x: 560, y: 300 },
        data: { label: "Intersection", color: "#6a7a3a" },
      },
    ],
    edges: [
      { id: "sp1", source: "sub1", target: "cross1" },
      { id: "sp2", source: "main", target: "cross1" },
      { id: "sp3", source: "sub2", target: "cross2" },
      { id: "sp4", source: "main", target: "cross2" },
    ],
  },
];
