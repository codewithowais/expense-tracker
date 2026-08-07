import { getDB } from "@/lib/db/database";
import { newId, nowISO } from "@/lib/crypto";
import { parseSplitwiseHtml } from "@/lib/splitwise/parse";
import { buildReport } from "@/lib/splitwise/report";
import { EMPTY_REPORT, type SplitwiseReport } from "@/lib/splitwise/types";
import type { DebtKind } from "@/lib/types";

/** Marker note so Splitwise-sourced debt entries are identifiable + reversible. */
const SW_NOTE = "Splitwise balance";

/**
 * Reflect the imported net-per-person balances into the SYNCED People & Debts
 * ledger, so Splitwise and People & Debts are one connected model:
 *   - People & Debts holds the live balances (small, synced).
 *   - The Splitwise archive holds the deep history (large, local) for Insights.
 * One deterministic "opening balance" entry per person keeps it idempotent —
 * re-importing recomputes and overwrites it rather than stacking up.
 */
async function reconcilePeopleAndDebts(report: SplitwiseReport): Promise<void> {
  const db = getDB();
  const now = nowISO();
  const today = now.slice(0, 10);
  const live = (await db.people.toArray()).filter((p) => !p.deletedAt);
  const byName = new Map(live.map((p) => [p.name.toLowerCase(), p]));

  for (const agg of report.byPerson) {
    let person = byName.get(agg.person.toLowerCase());
    if (!person) {
      person = {
        id: newId(),
        name: agg.person,
        note: "Imported from Splitwise",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db.people.add(person);
      byName.set(agg.person.toLowerCase(), person);
    }
    const entryId = `sw-${person.id}`;
    if (agg.net === 0) {
      const existing = await db.debtEntries.get(entryId);
      if (existing && !existing.deletedAt) {
        await db.debtEntries.update(entryId, { deletedAt: now, updatedAt: now });
      }
      continue;
    }
    const kind: DebtKind = agg.net > 0 ? "lent" : "borrowed";
    await db.debtEntries.put({
      id: entryId,
      personId: person.id,
      kind,
      amount: Math.abs(agg.net),
      note: SW_NOTE,
      date: today,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }
}

/**
 * Local-only Splitwise archive. Import parses a printable-summary HTML export
 * into indexed rows (per person × expense) and caches an aggregate report.
 * Re-importing the same group REPLACES that group's rows (idempotent), so you
 * can re-run an updated export without duplicates.
 */
export const splitwiseRepo = {
  /** Import one Splitwise printable-summary HTML export. */
  async importHtml(html: string): Promise<{ group: string; added: number }> {
    const db = getDB();
    const parsed = parseSplitwiseHtml(html);
    const rows = parsed.entries.map((e) => ({ ...e, id: newId() }));

    let report: SplitwiseReport = EMPTY_REPORT;
    await db.transaction("rw", db.splitwiseEntries, db.splitwiseMeta, async () => {
      // Replace any prior import of this same group.
      await db.splitwiseEntries.where("group").equals(parsed.group).delete();
      if (rows.length) await db.splitwiseEntries.bulkAdd(rows);

      // Rebuild the cached report over ALL groups currently stored.
      const all = await db.splitwiseEntries.toArray();
      report = buildReport(all);
      await db.splitwiseMeta.put({
        id: "summary",
        report,
        importedAt: nowISO(),
        sources: report.groups,
      });
    });

    // Link the balances into the synced People & Debts ledger.
    await reconcilePeopleAndDebts(report);

    return { group: parsed.group, added: rows.length };
  },

  /** The cached aggregate report (EMPTY_REPORT when nothing imported). */
  async getReport(): Promise<SplitwiseReport> {
    const meta = await getDB().splitwiseMeta.get("summary");
    return meta?.report ?? EMPTY_REPORT;
  },

  /** All entries for one person, newest first — for drill-down. */
  async listByPerson(person: string) {
    const rows = await getDB().splitwiseEntries.where("person").equals(person).toArray();
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  },

  /** Remove the entire imported archive AND the linked People & Debts balances
   *  (fully reversible). Manually-added people/entries are untouched. */
  async clear(): Promise<void> {
    const db = getDB();
    const now = nowISO();
    await db.transaction("rw", db.splitwiseEntries, db.splitwiseMeta, db.debtEntries, async () => {
      await db.splitwiseEntries.clear();
      await db.splitwiseMeta.clear();
      // Tombstone the Splitwise-sourced opening balances (note isn't indexed,
      // so filter rather than where()).
      await db.debtEntries
        .filter((e) => e.note === SW_NOTE && !e.deletedAt)
        .modify({ deletedAt: now, updatedAt: now });
    });
  },
};
