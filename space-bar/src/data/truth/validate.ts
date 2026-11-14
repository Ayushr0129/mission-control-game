import { SOURCE_DOCUMENTS, sourceDocumentIds } from './registry';
import { TRUTH_MISSIONS } from './missions';
import { TRUTH_ROCKETS } from './rockets';

export interface TruthValidation { valid: boolean; errors: string[] }

const isSourced = (value: unknown): value is { value: unknown; source: { document: string; location: string; retrieved: string; status: string } } => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!('value' in candidate) || !candidate.source || typeof candidate.source !== 'object') return false;
  const source = candidate.source as Record<string, unknown>;
  return typeof source.document === 'string' && typeof source.location === 'string' && typeof source.retrieved === 'string' && ['verified', 'approximate', 'placeholder'].includes(String(source.status));
};

export const validateTruthData = (): TruthValidation => {
  const errors: string[] = [];
  const inspect = (record: Record<string, unknown>, label: string) => {
    for (const [key, field] of Object.entries(record)) {
      if (key === 'id' || key === 'name') continue;
      if (!isSourced(field)) errors.push(`${label}.${key} is not sourced`);
      else if (!sourceDocumentIds.has(field.source.document)) errors.push(`${label}.${key} references unknown document ${field.source.document}`);
    }
  };
  TRUTH_ROCKETS.forEach((record) => inspect(record as unknown as Record<string, unknown>, `rocket:${record.id}`));
  TRUTH_MISSIONS.forEach((record) => inspect(record as unknown as Record<string, unknown>, `mission:${record.id}`));
  for (const document of SOURCE_DOCUMENTS) {
    if (!document.id || !document.title || !document.url || !document.localPath) errors.push(`Incomplete source document ${document.id}`);
  }
  return { valid: errors.length === 0, errors };
};
