import { describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/schemas/profile";

const validProfile = {
  fullName: "Alex Student",
  universityName: "North University",
  major: "Biology",
  yearOfStudy: 2,
  bio: "I enjoy learning with a small group.",
  subjects: "Biology, Statistics",
  learningGoals: "Prepare for exams, Stay motivated",
  availabilityDays: ["1", "3", "5"],
  preferredHours: "afternoon",
  studyFormat: "hybrid",
  groupSize: 4,
  language: "English",
  showInDiscovery: true,
};

describe("profileSchema", () => {
  it("accepts and normalizes a valid study profile", () => {
    expect(profileSchema.parse(validProfile)).toMatchObject({
      subjects: ["Biology", "Statistics"],
      learningGoals: ["Prepare for exams", "Stay motivated"],
      availabilityDays: ["1", "3", "5"],
      showInDiscovery: true,
    });
  });

  it("rejects profiles with no availability or an invalid format", () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      availabilityDays: [],
      studyFormat: "remote",
    });

    expect(result.success).toBe(false);
  });

  it("rejects overlong or excessive list entries instead of truncating them", () => {
    const tooManySubjects = Array.from(
      { length: 13 },
      (_, index) => `Subject ${index + 1}`,
    ).join(", ");
    const longSubject = "x".repeat(81);

    expect(
      profileSchema.safeParse({ ...validProfile, subjects: tooManySubjects })
        .success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...validProfile, subjects: longSubject })
        .success,
    ).toBe(false);
  });

  it("requires users to choose whether their profile is discoverable", () => {
    expect(
      profileSchema.safeParse({ ...validProfile, showInDiscovery: undefined })
        .success,
    ).toBe(false);
  });
});
