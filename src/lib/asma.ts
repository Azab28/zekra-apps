/**
 * The ninety-nine names of Allah as Jami' at-Tirmidhi (3507) lists them,
 * taken from the hadith data by `bun run content:asma` (data/asma-husna.json).
 * Client-safe (a small JSON file).
 */
import data from "../../data/asma-husna.json";

export const ASMA: readonly string[] = data.names;
export const ASMA_SOURCE = { ...data.source, grades: data.source.grades.map(([by, grade]) => [by, grade] as [string, string]) };
export const isAsmaNumber = (n: number) => Number.isInteger(n) && n >= 1 && n <= ASMA.length;
