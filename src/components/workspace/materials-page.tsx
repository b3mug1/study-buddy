import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, FileText, LoaderCircle } from "lucide-react";
import Link from "@/components/navigation/link";
import { authenticatedApiJson } from "@/lib/api-client";
import type { GroupMaterial, StudyGroup } from "@/lib/api-types";
import { useI18n } from "@/lib/i18n";

type GroupMaterials = {
  id: string;
  name: string;
  subject: string;
  materials: GroupMaterial[];
};

export function MaterialsPage() {
  const { t } = useI18n();
  const [groups, setGroups] = useState<GroupMaterials[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const memberGroups = (
          await authenticatedApiJson<StudyGroup[]>("groups")
        ).filter((group) => group.is_member);
        const results = await Promise.allSettled(
          memberGroups.map(async (group) => ({
            ...group,
            materials: await authenticatedApiJson<GroupMaterial[]>(
              `groups/${group.id}/materials`,
            ),
          })),
        );
        if (!active) return;
        setGroups(
          results.flatMap((result) =>
            result.status === "fulfilled" ? [result.value] : [],
          ),
        );
        setPartial(results.some((result) => result.status === "rejected"));
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("Unable to load materials."),
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <main className="campus-materials">
      <header className="campus-materials__header">
        <p className="campus-kicker">{t("Your study space")}</p>
        <h1>{t("Shared materials")}</h1>
        <p>{t("Notes, files, and links from your study groups.")}</p>
      </header>
      {loading ? (
        <div className="campus-empty" role="status">
          <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />{" "}
          {t("Loading your study space...")}
        </div>
      ) : error ? (
        <p className="campus-notice" role="alert">
          {error}
        </p>
      ) : (
        <>
          {partial && (
            <p className="campus-notice" role="status">
              {t("Some group materials could not be loaded.")}
            </p>
          )}
          {groups.length
            ? groups.map((group) => (
                <section className="campus-materials__group" key={group.id}>
                  <div className="campus-section__heading">
                    <h2>{group.name}</h2>
                    <Link
                      href={`/groups/${group.id}#shared-materials`}
                      className="campus-text-link"
                    >
                      {t("Open group")}{" "}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                  <p className="campus-materials__subject">{group.subject}</p>
                  {group.materials.length ? (
                    <ul>
                      {group.materials.map((material) => (
                        <li key={material.id}>
                          <Link href={`/groups/${group.id}#shared-materials`}>
                            <FileText size={18} aria-hidden="true" />
                            <span>
                              <strong>{material.title}</strong>
                              <small>
                                {material.file_name ||
                                  material.description ||
                                  t("Shared material")}
                              </small>
                            </span>
                            <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="campus-empty">
                      {t("No shared materials yet.")}
                    </p>
                  )}
                </section>
              ))
            : !partial && (
                <div className="campus-materials__empty">
                  <BookOpen size={24} aria-hidden="true" />
                  <p>
                    {t("Join a study group to collect shared materials here.")}
                  </p>
                  <Link href="/groups" className="campus-text-link">
                    {t("Browse study groups")}{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              )}
        </>
      )}
      <p className="campus-materials__notes">
        <Link href="/notes" className="campus-text-link">
          {t("Open your personal notes")}{" "}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </p>
    </main>
  );
}
