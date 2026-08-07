import type { SplitwiseParseResult } from "@/lib/splitwise/types";

/**
 * Parse a Splitwise "printable summary" HTML export into per-person lines from
 * YOUR perspective.
 *
 * A summary can contain MANY sections (one per <h2>):
 *  - GROUP sections have a header with a net-balance column per member.
 *  - Per-member sections ("You paid / Your share / Balance") re-show the same
 *    expenses from one member's view — skipped (they'd double-count).
 *
 * Two kinds of lines are captured:
 *  1. Member columns → one entry per member per expense (delta = −member net).
 *  2. Settlement descriptions ("A paid B") involving you and a NON-member →
 *     an entry for that other person, so people who only appear in settlements
 *     (e.g. "Fariha K. paid Codewithowais") are still surfaced.
 */

function num(s?: string): number {
  if (!s) return 0;
  const neg = s.includes("-");
  const v = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  return neg ? -v : v;
}

// Header columns that are NOT people (the per-member section layout).
const NON_PERSON = /^(you paid|your share|balance)$/i;

export function parseSplitwiseHtml(html: string): SplitwiseParseResult {
  const meMatch = html.match(/<th[^>]*>\s*(Codewithowais[^<]*)<\/th>/i);
  const me = (meMatch ? meMatch[1] : "Codewithowais").trim();
  const meLc = me.toLowerCase();

  const entries: SplitwiseParseResult["entries"] = [];
  const peopleSet = new Set<string>();
  const groupNames: string[] = [];

  const sectionRe = /<h2>([^<]*)<\/h2>([\s\S]*?)(?=<h2>|$)/g;
  let sec: RegExpExecArray | null;
  while ((sec = sectionRe.exec(html)) !== null) {
    const title = sec[1].trim();
    const body = sec[2];

    const headerBlock = (body.match(/<tr class="gray">([\s\S]*?)<\/tr>/) || [])[1] || "";
    const cols = [...headerBlock.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1].trim()).slice(3);
    const memberCols = cols.filter((c) => c && !NON_PERSON.test(c));
    if (memberCols.length === 0) continue; // per-member section — skip

    groupNames.push(title);
    const meIdx = cols.findIndex((c) => c.toLowerCase() === meLc);
    const memberLc = new Set(cols.map((c) => c.toLowerCase()));

    for (const m of body.matchAll(/<tr class="expense">([\s\S]*?)<\/tr>/g)) {
      const block = m[1];
      const date = (block.match(/<td class="date">\s*([\d-]+)/) || [])[1];
      if (!date) continue;
      const description = ((block.match(/<td class="description">([^<]*)<\/td>/) || [])[1] || "").trim();
      const cost = num((block.match(/<td>\s*(-?PKR[\d.,]+)\s*<\/td>/) || [])[1]);
      const year = date.slice(0, 4);
      const ym = date.slice(0, 7);
      const cells = [...block.matchAll(/<td class="[^"]*net_balance">\s*(-?PKR[\d.,]+)/g)].map((x) =>
        num(x[1]),
      );

      // (1) Member net columns.
      cols.forEach((p, i) => {
        if (i === meIdx || NON_PERSON.test(p)) return;
        const cell = cells[i];
        if (cell === undefined || cell === 0) return;
        entries.push({ group: title, person: p, date, year, ym, description, cost, delta: -cell });
        peopleSet.add(p);
      });

      // (2) Settlement with a non-member: "<A> paid <B>" where exactly one is you.
      const settle = description.match(/^(.+?)\s+paid\s+(.+?)$/i);
      if (settle && cost > 0) {
        const payer = settle[1].trim();
        const payee = settle[2].trim();
        const mePayer = payer.toLowerCase() === meLc;
        const mePayee = payee.toLowerCase() === meLc;
        if (mePayer !== mePayee) {
          const other = mePayer ? payee : payer;
          const otherLc = other.toLowerCase();
          if (otherLc !== meLc && !memberLc.has(otherLc)) {
            // You paid them → they owe you (+); they paid you → you owe / they owe less (−).
            entries.push({
              group: title,
              person: other,
              date,
              year,
              ym,
              description,
              cost,
              delta: mePayer ? cost : -cost,
            });
            peopleSet.add(other);
          }
        }
      }
    }
  }

  return {
    group: groupNames.join(", ") || "Splitwise",
    me,
    people: [...peopleSet].filter((p) => p.toLowerCase() !== meLc),
    entries,
  };
}
