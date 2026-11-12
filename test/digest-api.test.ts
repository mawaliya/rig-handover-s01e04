import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest JSON endpoint', () => {
  it('returns the same jobs in the same order as the page', async () => {
    const app = createApp(config);
    const response = await app.request('/api/digest/2026-10-28');
    const rows = await response.json() as { job: string }[];
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    const pagePositions = rows.map(({ job }) => html.indexOf(`<td>${job}</td>`));

    expect(response.status).toBe(200);
    expect(rows.map(({ job }) => job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(pagePositions.every((position) => position >= 0)).toBe(true);
    expect(pagePositions).toEqual([...pagePositions].sort((a, b) => a - b));
  });
});