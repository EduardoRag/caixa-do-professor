export const LESSON_DAYS = [
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
] as const;

export function lessonDaysLabel(days: readonly number[]) {
  return LESSON_DAYS.filter((day) => days.includes(day.value)).map((day) => day.short).join(" · ");
}

export function currentLessonDay(now: Date) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => date.find((p) => p.type === type)?.value ?? "";
  const iso = `${part("year")}-${part("month")}-${part("day")}`;
  return {
    weekday: new Date(`${iso}T12:00:00Z`).getUTCDay(),
    label: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit",
    }).format(now),
  };
}

export function studentsForLessonDay<T extends { is_active: boolean; lesson_days: readonly number[] }>(students: readonly T[], weekday: number): T[] {
  return students.filter((student) => student.is_active && student.lesson_days.includes(weekday));
}