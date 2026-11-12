import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNightResult } from './types.js';

type RunRecord = {
  at: string;
  job: string;
  status: DigestRow['lastStatus'];
  owner: string | null;
  error?: string;
};

function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.at === 'string' &&
    Number.isFinite(Date.parse(record.at)) &&
    typeof record.job === 'string' &&
    record.job.length > 0 &&
    (record.status === 'ok' || record.status === 'retry' || record.status === 'fail') &&
    (record.owner === null || typeof record.owner === 'string') &&
    (record.error === undefined || typeof record.error === 'string')
  );
}

export function readNight(runsDir: string, night: string): ReadNightResult {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = contents.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  const jobs = new Map<string, { row: DigestRow; firstTime: number; lastTime: number }>();
  let malformedLines = 0;

  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      malformedLines += 1;
      continue;
    }

    if (!isRunRecord(value)) {
      malformedLines += 1;
      continue;
    }

    const time = Date.parse(value.at);
    const existing = jobs.get(value.job);

    if (!existing) {
      jobs.set(value.job, {
        row: {
          job: value.job,
          owner: value.owner,
          runs: 1,
          retries: value.status === 'retry' ? 1 : 0,
          lastStatus: value.status,
          lastError: value.error ?? null,
          firstAt: value.at,
          lastAt: value.at,
        },
        firstTime: time,
        lastTime: time,
      });
      continue;
    }

    existing.row.runs += 1;
    if (value.status === 'retry') existing.row.retries += 1;
    if (time < existing.firstTime) {
      existing.firstTime = time;
      existing.row.firstAt = value.at;
    }
    if (time >= existing.lastTime) {
      existing.lastTime = time;
      existing.row.lastAt = value.at;
      existing.row.owner = value.owner;
      existing.row.lastStatus = value.status;
      existing.row.lastError = value.error ?? null;
    }
  }

  const rows = [...jobs.values()].map(({ row }) => row);
  rows.sort((a, b) => a.job.localeCompare(b.job));

  return { rows, malformedLines };
}
