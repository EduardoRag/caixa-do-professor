import { describe, expect, it } from "vitest";
import { currentLessonDay, studentsForLessonDay } from "./lesson-days";

describe("weekly lessons", () => {
  const students = [
    { id: "multiple", is_active: true, lesson_days: [1, 4] },
    { id: "friday", is_active: true, lesson_days: [5] },
    { id: "inactive", is_active: false, lesson_days: [1] },
    { id: "unspecified", is_active: true, lesson_days: [] },
    { id: "sunday", is_active: true, lesson_days: [0] },
  ];

  it("includes the same student on each chosen day, not other days", () => {
    expect(studentsForLessonDay(students, 1).map((s) => s.id)).toEqual(["multiple"]);
    expect(studentsForLessonDay(students, 4).map((s) => s.id)).toEqual(["multiple"]);
    expect(studentsForLessonDay(students, 5).map((s) => s.id)).toEqual(["friday"]);
  });
  it("excludes inactive students and students without chosen days", () => {
    expect(studentsForLessonDay(students.slice(2, 4), 1)).toEqual([]);
  });
  it("supports Sunday", () => {
    expect(studentsForLessonDay(students, 0).map((s) => s.id)).toEqual(["sunday"]);
  });
  it("uses today's date in Sao Paulo, even when UTC is already tomorrow", () => {
    expect(currentLessonDay(new Date("2026-10-23T02:24:00Z")).weekday).toBe(4);
    expect(currentLessonDay(new Date("2026-10-23T03:00:00Z")).weekday).toBe(5);
  });
});