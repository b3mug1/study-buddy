"use client";

import { useCallback, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useOutletContext } from "react-router";
import {
  createNoteId,
  loadNotes,
  sanitizeNoteBody,
  sanitizeNoteTitle,
  saveNotes,
  type StudyNote,
} from "@/lib/study-notes";
import type { StudentProfile } from "@/lib/api-types";

export function NotesPage() {
  const { t, locale } = useI18n();
  const { profile } = useOutletContext<{ profile: StudentProfile }>();
  const ownerId = profile?.full_name ?? "";
  const [notes, setNotes] = useState<StudyNote[]>(() =>
    loadNotes(profile?.full_name ?? ""),
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const dateLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";

  const persist = useCallback(
    (next: StudyNote[]) => {
      const sorted = [...next].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
      setNotes(sorted);
      saveNotes(ownerId, sorted);
    },
    [ownerId],
  );

  function resetForm() {
    setTitle("");
    setBody("");
    setEditingId(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanTitle = sanitizeNoteTitle(title);
    const cleanBody = sanitizeNoteBody(body);
    if (!cleanTitle || !cleanBody) {
      toast.error(t("Add a note title and some text before saving."));
      return;
    }

    const now = new Date().toISOString();
    if (editingId) {
      persist(
        notes.map((note) =>
          note.id === editingId
            ? { ...note, title: cleanTitle, body: cleanBody, updatedAt: now }
            : note,
        ),
      );
      toast.success(t("Note updated."));
    } else {
      persist([
        {
          id: createNoteId(),
          title: cleanTitle,
          body: cleanBody,
          createdAt: now,
          updatedAt: now,
        },
        ...notes,
      ]);
      toast.success(t("Note saved."));
    }
    resetForm();
  }

  function startEditing(note: StudyNote) {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
  }

  function remove(note: StudyNote) {
    persist(notes.filter((item) => item.id !== note.id));
    if (editingId === note.id) resetForm();
    toast.success(t("Note deleted."));
  }

  return (
    <main className="notes-page">
      <header className="dashboard-heading" data-motion>
        <div>
          <p className="academic-kicker">{t("Your study material")}</p>
          <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">
            {t("My notes")}
          </h1>
        </div>
      </header>

      <form className="notes-composer" onSubmit={submit} data-motion>
        <div className="notes-composer__row">
          <label className="notes-field">
            <span className="notes-field__label">{t("Note title")}</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder={t("Chapter 4: Linear equations")}
              className="field-control"
            />
          </label>
          <div className="notes-field">
            <span className="notes-field__label" aria-hidden="true" />
            <button type="submit" className="btn w-full">
              {editingId ? (
                <Pencil size={16} aria-hidden="true" />
              ) : (
                <Plus size={16} aria-hidden="true" />
              )}
              {editingId ? t("Save changes") : t("Add note")}
            </button>
          </div>
        </div>
        <label className="notes-field">
          <span className="notes-field__label">{t("Note text")}</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1200}
            rows={4}
            placeholder={t("Write the key idea in your own words.")}
            className="field-control resize-y"
          />
        </label>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="portal-inline-link self-start"
          >
            <X size={14} aria-hidden="true" />
            {t("Cancel editing")}
          </button>
        )}
      </form>

      {notes.length ? (
        <ul className="notes-grid">
          {notes.map((note, index) => (
            <li key={note.id} className="notes-grid__item">
              <article className={`desk-note desk-note--${index % 4}`}>
                <div className="desk-note__head">
                  <h2 className="desk-note__title">{note.title}</h2>
                  <div className="notes-note__tools">
                    <button
                      type="button"
                      onClick={() => startEditing(note)}
                      aria-label={t("Edit note {title}", { title: note.title })}
                      className="notes-note__tool"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(note)}
                      aria-label={t("Delete {title}", { title: note.title })}
                      className="notes-note__tool"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <p className="desk-note__body whitespace-pre-line">
                  {note.body}
                </p>
                <p className="desk-note__date">
                  {new Date(note.updatedAt).toLocaleDateString(dateLocale, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="desk-empty" data-motion data-motion-delay="100">
          <p>{t("No notes yet. Add your first one above.")}</p>
        </div>
      )}
    </main>
  );
}
