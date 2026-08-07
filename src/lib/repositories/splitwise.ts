import { getDB } from "@/lib/db/database";
import { newId, nowISO } from "@/lib/crypto";
import { parseSplitwiseHtml } from "@/lib/splitwise/parse";
import { buildReport } from "@/lib/splitwise/report";
import { EMPTY_REPORT, type SplitwiseReport } from "@/lib/splitwise/types";

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

    await db.transaction("rw", db.splitwiseEntries, db.splitwiseMeta, async () => {
      // Replace any prior import of this same group.
      await db.splitwiseEntries.where("group").equals(parsed.group).delete();
      if (rows.length) await db.splitwiseEntries.bulkAdd(rows);

      // Rebuild the cached report over ALL groups currently stored.
      const all = await db.splitwiseEntries.toArray();
      const report = buildReport(all);
      await db.splitwiseMeta.put({
        id: "summary",
        report,
        importedAt: nowISO(),
        sources: report.groups,
      });
    });

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

  /** Remove the entire imported archive (reversible action for the user). */
  async clear(): Promise<void> {
    const db = getDB();
    await db.transaction("rw", db.splitwiseEntries, db.splitwiseMeta, async () => {
      await db.splitwiseEntries.clear();
      await db.splitwiseMeta.clear();
    });
  },
};
