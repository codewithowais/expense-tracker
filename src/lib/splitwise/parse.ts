import type { SplitwiseParseResult, SplitwiseEntry } from "@/lib/splitwise/types";

/**
 * Parse a Splitwise "printable summary" HTML export into structured data.
 *
 * Pure, dependency-free, and defensive: malformed rows are skipped rather than
 * thrown on, so a partial/garbled export still yields whatever is parseable.
 *
 * Perspective is always YOU (the person whose header matches `codewithowais`).
 * Splitwise records each person's net balance for an expense as a signed
 * amount; a NEGATIVE net means that person owes into the pot, which — from your
 * side — means they owe YOU. Hence `delta = -cellValue` (positive delta =
 * "they owe you"). This mapping is verified to reconcile against Splitwise's
 * own balances.
 */
export function parseSplitwiseHtml(html: string): SplitwiseParseResult {
  const source = typeof html === "string" ? html : "";

  // 1. Group name.
  const groupMatch = source.match(/<h2>([^<]+)<\/h2>/);
  const group = groupMatch ? groupMatch[1].trim() : "Group";

  // 2. People headers: first `gray` row, all <th>, drop Date/Description/Cost.
  const headerRowMatch = source.match(/<tr class="gray">([\s\S]*?)<\/tr>/);
  const headerPeople: string[] = [];
  if (headerRowMatch) {
    const thMatches = [...headerRowMatch[1].matchAll(/<th>([^<]*)<\/th>/g)];
    for (const th of thMatches) headerPeople.push(th[1].trim());
    headerPeople.splice(0, 3);
  }

  // 3. Identify "me".
  const me = headerPeople.find((p) => /codewithowais/i.test(p)) ?? "";

  // 4. Signed number parser: "-PKR1,234.50" -> -1234.5
  const num = (s: string): number => {
    const negative = s.includes("-");
    const value = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
    return negative ? -value : value;
  };

  // 5. Expense rows.
  const entries: Omit<SplitwiseEntry, "id">[] = [];
  const expenseBlocks = source.matchAll(/<tr class="expense">([\s\S]*?)<\/tr>/g);
  for (const [, block] of expenseBlocks) {
    const dateMatch = block.match(/<td class="date">\s*([\d-]+)/);
    if (!dateMatch) continue; // skip rows without a date
    const date = dateMatch[1];

    const descMatch = block.match(/<td class="description">([^<]*)<\/td>/);
    const description = descMatch ? descMatch[1].trim() : "";

    const costMatch = block.match(/<td>\s*(-?PKR[\d.,]+)\s*<\/td>/);
    const cost = costMatch ? num(costMatch[1]) : 0;

    const cells = [
      ...block.matchAll(/<td class="[^"]*net_balance">\s*(-?PKR[\d.,]+)/g),
    ].map((m) => num(m[1]));

    for (let i = 0; i < headerPeople.length; i++) {
      const person = headerPeople[i];
      const cell = cells[i];
      if (person === me) continue;
      if (cell === undefined || cell === 0) continue;
      entries.push({
        group,
        person,
        date,
        year: date.slice(0, 4),
        ym: date.slice(0, 7),
        description,
        cost,
        delta: -cell,
      });
    }
  }

  // 6. Result.
  return { group, me, people: headerPeople.filter((p) => p !== me), entries };
}
