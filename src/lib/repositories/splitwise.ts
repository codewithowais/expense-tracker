import { getDB } from "@/lib/db/database";
import { newId, nowISO } from "@/lib/crypto";
import { parseSplitwiseHtml } from "@/lib/splitwise/parse";
import { buildReport } from "@/lib/splitwise/report";
import { EMPTY_REPORT, type SplitwiseReport } from "@/lib/splitwise/types";
import type { DebtKind, Person } from "@/lib/types";

/**
 * Splitwise import.
 *
 * Two things happen on import:
 *  1. The raw lines are stored in the LOCAL, indexed `splitwiseEntries` archive
 *     — used only to compute the fast aggregate report for the Insights page.
 *  2. Each line is ALSO written as a real, SYNCED People & Debts entry (id
 *     prefixed `sw-`), so every record with a person shows up natively in their
 *     People & Debts history on every device, and balances are just their sum.
 *
 * `sw-` prefixed debt entries are fully managed here: a re-import rebuilds them,
 * and "Clear imported data" tombstones them — manual entries are never touched.
 */
export const splitwiseRepo = {
  async importHtml(html: string): Promise<{ group: string; added: number }> {
    const db = getDB();
    const parsed = parseSplitwiseHtml(html);
    const rows = parsed.entries.map((e) => ({ ...e, id: newId() }));

    // 1. Archive (local) — replace any prior import of the same group.
    await db.transaction("rw", db.splitwiseEntries, db.splitwiseMeta, async () => {
      await db.splitwiseEntries.where("group").equals(parsed.group).delete();
      if (rows.length) await db.splitwiseEntries.bulkAdd(rows);
      const all = await db.splitwiseEntries.toArray();
      const report = buildReport(all);
      await db.splitwiseMeta.put({
        id: "summary",
        report,
        importedAt: nowISO(),
        sources: report.groups,
      });
    });

    // 2. Rebuild the synced People & Debts entries from the full archive.
    await rebuildDebtLedger();

    return { group: parsed.group, added: rows.length };
  },

  async getReport(): Promise<SplitwiseReport> {
    const meta = await getDB().splitwiseMeta.get("summary");
    if (meta?.report) return meta.report;
    // Fallback (e.g. archive present but meta missing): compute on the fly.
    const all = await getDB().splitwiseEntries.toArray();
    return all.length ? buildReport(all) : EMPTY_REPORT;
  },

  async listByPerson(person: string) {
    const rows = await getDB().splitwiseEntries.where("person").equals(person).toArray();
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  },

  /** Remove the archive AND the synced Splitwise debt entries (reversible). */
  async clear(): Promise<void> {
    const db = getDB();
    const now = nowISO();
    await db.transaction("rw", db.splitwiseEntries, db.splitwiseMeta, db.debtEntries, async () => {
      await db.splitwiseEntries.clear();
      await db.splitwiseMeta.clear();
      const sw = await db.debtEntries.where("id").startsWith("sw-").toArray();
      for (const e of sw) {
        if (!e.deletedAt) await db.debtEntries.update(e.id, { deletedAt: now, updatedAt: now });
      }
    });
  },
};

/**
 * Turn every archived Splitwise line into a synced People & Debts entry.
 * People are matched/created by name; each line becomes one debt entry whose
 * delta reconstructs the person's balance (positive = they owe you → "lent",
 * negative = you owe → "borrowed").
 */
async function rebuildDebtLedger(): Promise<void> {
  const db = getDB();
  const now = nowISO();
  const archive = await db.splitwiseEntries.toArray();

  // Ensure a Person exists for each name.
  const livePeople = (await db.people.toArray()).filter((p) => !p.deletedAt);
  const byName = new Map(livePeople.map((p) => [p.name.toLowerCase(), p]));
  for (const name of new Set(archive.map((a) => a.person))) {
    if (!byName.has(name.toLowerCase())) {
      const person: Person = {
        id: newId(),
        name,
        note: "Imported from Splitwise",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db.people.add(person);
      byName.set(name.toLowerCase(), person);
    }
  }

  // Tombstone the previous Splitwise-sourced entries (so peers drop them too).
  const prior = await db.debtEntries.where("id").startsWith("sw-").toArray();
  for (const e of prior) {
    if (!e.deletedAt) await db.debtEntries.update(e.id, { deletedAt: now, updatedAt: now });
  }

  // Recreate one debt entry per archived line.
  const entries = archive.map((a) => {
    const person = byName.get(a.person.toLowerCase());
    return {
      id: `sw-${a.id}`,
      personId: person!.id,
      kind: (a.delta >= 0 ? "lent" : "borrowed") as DebtKind,
      amount: Math.abs(a.delta),
      note: a.description?.trim() ? a.description.trim() : a.group,
      date: a.date,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  });
  if (entries.length) await db.debtEntries.bulkPut(entries);
}
