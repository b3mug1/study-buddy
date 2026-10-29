/**
 * Study notes are stored locally per student account.
 *
 * Notes are personal study material and never leave the browser, so they live in
 * `localStorage` keyed by the signed-in student's id instead of the API.
 */

export type StudyNote = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_PREFIX = "study-buddy:notes:";
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 1200;

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}${ownerId || "anonymous"}`;
}

function isStudyNote(value: unknown): value is StudyNote {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudyNote>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

export function createNoteId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeNoteText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

export function sanitizeNoteTitle(value: string) {
  return sanitizeNoteText(value, MAX_TITLE_LENGTH);
}

export function sanitizeNoteBody(value: string) {
  return sanitizeNoteText(value, MAX_BODY_LENGTH);
}

export function loadNotes(ownerId: string): StudyNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const notes = parsed.filter(isStudyNote).map((note) => ({
      ...note,
      title: sanitizeNoteTitle(note.title),
      body: sanitizeNoteBody(note.body),
    }));
    return notes.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  } catch {
    return [];
  }
}

export function saveNotes(ownerId: string, notes: StudyNote[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(ownerId), JSON.stringify(notes));
  } catch {
    // Storage can be unavailable (private mode or a full quota); notes stay in memory.
  }
}
