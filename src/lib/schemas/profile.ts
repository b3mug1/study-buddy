import { z } from "zod";

function commaSeparatedList(maxItemLength: number) {
  return z
    .string()
    .trim()
    .min(1, "Add at least one item.")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().min(1).max(maxItemLength))
        .min(1, "Add at least one item.")
        .max(12, "Add no more than 12 items."),
    )
    .transform((values) => [...new Set(values)]);
}

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80),
  universityName: z.string().trim().min(2, "Enter your university.").max(120),
  major: z.string().trim().min(2, "Enter your faculty or major.").max(120),
  yearOfStudy: z.coerce.number().int().min(1).max(12),
  bio: z.string().trim().max(300, "Keep your bio under 300 characters."),
  subjects: commaSeparatedList(80),
  learningGoals: commaSeparatedList(100),
  availabilityDays: z
    .array(z.enum(["0", "1", "2", "3", "4", "5", "6"]))
    .min(1, "Choose at least one available day.")
    .max(7),
  preferredHours: z.enum(["morning", "afternoon", "evening"]),
  studyFormat: z.enum(["online", "offline", "hybrid"]),
  groupSize: z.coerce.number().int().min(2).max(12),
  language: z.string().trim().min(2, "Enter a preferred language.").max(40),
  showInDiscovery: z.boolean(),
});

export type ProfileFormValues = z.input<typeof profileSchema>;
export type ValidProfile = z.output<typeof profileSchema>;

export const weekdayOptions = [
  { label: "Mon", value: "1" },
  { label: "Tue", value: "2" },
  { label: "Wed", value: "3" },
  { label: "Thu", value: "4" },
  { label: "Fri", value: "5" },
  { label: "Sat", value: "6" },
  { label: "Sun", value: "0" },
] as const;

export function parseListInput(value: string[] | string | null | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value.join(", ") : value;
}
