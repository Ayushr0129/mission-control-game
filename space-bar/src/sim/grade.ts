import { Chapter, Meters, Totals } from './types';

export interface GradeConfig {
  wBudget: number; wDays: number; wMargins: number; // efficiency weights (sum 1)
  teamworkBonus: number; scienceBonus: number;                            // points added at 100% teamwork
  parDays: number; thresholds: { S: number; A: number; B: number };
  latePenalty: number;
}
/** All grade tuning lives here (design doc 4.5). */
export const GRADE_CONFIG: GradeConfig = {
  wBudget: 0.4, wDays: 0.3, wMargins: 0.3, teamworkBonus: 15, scienceBonus: 10, parDays: 700,
  thresholds: { S: 90, A: 75, B: 55 }, latePenalty: 10,
};

export interface Grade { letter: 'S' | 'A' | 'B' | 'C'; score: number; efficiency: number; teamwork: number; parts: Record<string, number> }

export function gradeChapter(ch: Chapter, meters: Meters, totals: Totals, conflictsTriggered: number, conflictRules: number, late: boolean, cfg = GRADE_CONFIG): Grade {
  const budgetScore = Math.min(1, meters.budget / ch.start.budget);
  const daysScore = Math.min(1, Math.max(0, 1 - (meters.day - cfg.parDays) / (ch.deadlineDay - cfg.parDays)));
  // efficiency = not overbuilding: unused mass and power margin are waste
  const massMargin = (totals.capacity - totals.mass) / totals.capacity;
  const powerMargin = (totals.gen - totals.load * 1.1) / totals.gen;
  const marginScore = 1 - Math.min(1, Math.max(0, massMargin - 0.08) * 3 + Math.max(0, powerMargin - 0.25) * 2);
  const efficiency = 100 * (cfg.wBudget * budgetScore + cfg.wDays * daysScore + cfg.wMargins * marginScore);
  const teamwork = conflictRules ? 1 - conflictsTriggered / conflictRules : 1;
  const science = Math.min(1, totals.science / 6);
  const score = Math.max(0, efficiency + cfg.teamworkBonus * teamwork + cfg.scienceBonus * science - (late ? cfg.latePenalty : 0));
  const letter = score >= cfg.thresholds.S ? 'S' : score >= cfg.thresholds.A ? 'A' : score >= cfg.thresholds.B ? 'B' : 'C';
  return { letter, score, efficiency, teamwork, parts: { budget: budgetScore, days: daysScore, margins: marginScore } };
}
