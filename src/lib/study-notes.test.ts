import { afterEach, expect, test, vi } from "vitest";

import {
  loadLegacyNotes,
  loadNotes,
  markLegacyNotesImported,
  saveNotes,
  type StudyNote,
} from "./study-notes";

afterEach(() => vi.unstubAllGlobals());

test("notes are separated by account ID and legacy import is explicit", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  const note: StudyNote = {
    id: "note-1",
    title: "Private study note",
    body: "Example",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  saveNotes("Alex Student", [note]);
  expect(loadNotes("account-a")).toEqual([]);
  expect(loadNotes("account-b")).toEqual([]);
  expect(loadLegacyNotes("account-a", "Alex Student")).toEqual([note]);

  saveNotes("account-a", loadLegacyNotes("account-a", "Alex Student"));
  markLegacyNotesImported("account-a", "Alex Student");
  expect(loadNotes("account-a")).toEqual([note]);
  expect(loadNotes("account-b")).toEqual([]);
  expect(loadLegacyNotes("account-a", "Alex Student")).toEqual([]);
});
