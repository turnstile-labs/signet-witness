// Programmable stub for the neon-serverless tagged-template client.
//
// Each production call like `sql`...` ` is one queue entry: push a
// row-array (success) or an Error instance (failure). Leaving the
// queue empty makes every further call resolve to `[]`.
//
// Test files import the enqueue/reset helpers; the sqlCalls array
// lets tests assert call order and inspect template / values if
// needed.

export type SqlResult = unknown[] | Error;

export const sqlQueue: SqlResult[] = [];
export const sqlCalls: Array<{ strings: TemplateStringsArray; values: unknown[] }> = [];

export function enqueueSql(...results: SqlResult[]): void {
  sqlQueue.push(...results);
}

export function resetSql(): void {
  sqlQueue.length = 0;
  sqlCalls.length = 0;
}

export async function sqlTag(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<unknown> {
  sqlCalls.push({ strings, values });
  if (!sqlQueue.length) return [];
  const next = sqlQueue.shift() as SqlResult;
  if (next instanceof Error) throw next;
  return next;
}
