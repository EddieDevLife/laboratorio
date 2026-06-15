export interface DOMSnapshot {
  id: string;
  sessionId: string;
  capturedAt: string;
  url: string;
  title: string;
  tree: unknown;    // serialized DOMNode tree from frontend
  stats: {
    total: number;
    interactive: number;
    focusable: number;
    withAria: number;
  };
}

export interface StateChange {
  id: string;
  sessionId: string;
  timestamp: string;
  fromSnapshotId: string | null;
  toSnapshotId: string;
  diff: StateDiff;
}

export interface StateDiff {
  added: string[];      // element UIDs added
  removed: string[];    // element UIDs removed
  changed: Array<{
    uid: string;
    fields: string[];
  }>;
  summary: string;
}

export interface StateStore {
  snapshots: Map<string, DOMSnapshot>;
  changes: StateChange[];
}
