import { Prisma } from "@/lib/generated/prisma/client";

/**
 * A small in-memory stand-in for the Prisma client, covering exactly the
 * operations the item/section/tag services use. It lets the integration tests
 * drive the real route handlers and real service logic end to end without a
 * live Postgres, so the flows under test are the ones that ship.
 */
interface ItemRow {
  id: string;
  userId: string;
  url: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  contentType: string;
  sourceType: string;
  sourcePlatform: string | null;
  savedAt: Date;
}

interface SectionRow {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
}
interface TagRow {
  id: string;
  userId: string;
  name: string;
}
interface JoinRow {
  itemId: string;
  otherId: string;
}
interface NoteRow {
  id: string;
  itemId: string;
  body: string;
  createdAt: Date;
}

/** The union of `where` shapes the services actually build. */
interface Where {
  userId?: string;
  id?: string | { in: string[] };
  itemId?: string;
  savedAt?: { lt: Date };
  sections?: { some: { sectionId: string } };
  tags?: { some: { tagId: string } };
  unique_user_url?: { userId: string; url: string };
  userId_name?: { userId: string; name: string };
}

interface Include {
  sections?: unknown;
  tags?: unknown;
  note?: unknown;
}

interface QueryArgs {
  where?: Where;
  include?: Include;
  select?: { _count?: unknown };
  orderBy?: { savedAt?: "asc" | "desc" };
  take?: number;
}

interface ItemCreateData {
  userId: string;
  url?: string | null;
  title?: string | null;
  thumbnailUrl?: string | null;
  contentType: string;
  sourceType: string;
  sourcePlatform?: string | null;
}

export class FakePrisma {
  items: ItemRow[] = [];
  sections: SectionRow[] = [];
  tags: TagRow[] = [];
  itemSections: JoinRow[] = [];
  itemTags: JoinRow[] = [];
  notes: NoteRow[] = [];

  private sequence = 0;
  private id(prefix: string) {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  /** Items are stored newest-last; savedAt is advanced so ordering is stable. */
  private nextSavedAt() {
    return new Date(Date.UTC(2026, 0, 1) + this.sequence * 60_000);
  }

  private hydrate(item: ItemRow, include?: Include) {
    if (!include) return { ...item };

    const result: Record<string, unknown> = { ...item };

    if (include.sections) {
      result.sections = this.itemSections
        .filter((join) => join.itemId === item.id)
        .map((join) => {
          const section = this.sections.find((row) => row.id === join.otherId)!;
          return { section: { id: section.id, name: section.name } };
        });
    }

    if (include.tags) {
      result.tags = this.itemTags
        .filter((join) => join.itemId === item.id)
        .map((join) => {
          const tag = this.tags.find((row) => row.id === join.otherId)!;
          return { tag: { id: tag.id, name: tag.name } };
        });
    }

    if (include.note) {
      result.note = this.notes.find((row) => row.itemId === item.id) ?? null;
    }

    return result;
  }

  private matches(item: ItemRow, where: Where = {}): boolean {
    if (where.userId && item.userId !== where.userId) return false;
    if (typeof where.id === "string" && item.id !== where.id) return false;

    if (where.savedAt?.lt && !(item.savedAt < where.savedAt.lt)) return false;

    const sectionId = where.sections?.some.sectionId;
    if (sectionId) {
      const has = this.itemSections.some(
        (join) => join.itemId === item.id && join.otherId === sectionId,
      );
      if (!has) return false;
    }

    const tagId = where.tags?.some.tagId;
    if (tagId) {
      const has = this.itemTags.some((join) => join.itemId === item.id && join.otherId === tagId);
      if (!has) return false;
    }

    return true;
  }

  item = {
    findUnique: async ({ where }: { where: Where }) => {
      const { userId, url } = where.unique_user_url!;
      return this.items.find((row) => row.userId === userId && row.url === url) ?? null;
    },
    findFirst: async ({ where, include }: QueryArgs) => {
      const found = this.items.find((row) => this.matches(row, where));
      return found ? this.hydrate(found, include) : null;
    },
    findUniqueOrThrow: async ({ where, include }: QueryArgs) => {
      const found = this.items.find((row) => row.id === where?.id);
      if (!found) throw new Error(`No item ${String(where?.id)}`);
      return this.hydrate(found, include);
    },
    findMany: async ({ where, orderBy, take, include }: QueryArgs) => {
      let rows = this.items.filter((row) => this.matches(row, where));

      if (orderBy?.savedAt === "desc") {
        rows = [...rows].sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
      }

      if (take) rows = rows.slice(0, take);
      return rows.map((row) => this.hydrate(row, include));
    },
    create: async ({ data }: { data: ItemCreateData }) => {
      const row: ItemRow = {
        id: this.id("item"),
        userId: data.userId,
        url: data.url ?? null,
        title: data.title ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        contentType: data.contentType,
        sourceType: data.sourceType,
        sourcePlatform: data.sourcePlatform ?? null,
        savedAt: this.nextSavedAt(),
      };
      this.items.push(row);
      return row;
    },
    deleteMany: async ({ where }: { where: Where }) => {
      const doomed = this.items.filter((row) => this.matches(row, where));
      this.items = this.items.filter((row) => !doomed.includes(row));

      for (const row of doomed) {
        this.itemSections = this.itemSections.filter((join) => join.itemId !== row.id);
        this.itemTags = this.itemTags.filter((join) => join.itemId !== row.id);
        this.notes = this.notes.filter((note) => note.itemId !== row.id);
      }

      return { count: doomed.length };
    },
    count: async ({ where }: { where: Where }) =>
      this.items.filter((row) => this.matches(row, where)).length,
  };

  section = {
    create: async ({ data }: { data: { userId: string; name: string } }) => {
      const row: SectionRow = {
        id: this.id("section"),
        userId: data.userId,
        name: data.name,
        createdAt: new Date(),
      };
      this.sections.push(row);
      return row;
    },
    findMany: async ({ where, select }: QueryArgs) => {
      const ids = typeof where?.id === "object" ? where.id.in : undefined;
      const rows = this.sections.filter(
        (row) => (!where?.userId || row.userId === where.userId) && (!ids || ids.includes(row.id)),
      );

      return rows.map((row) =>
        select?._count
          ? {
              id: row.id,
              name: row.name,
              _count: {
                items: this.itemSections.filter((join) => join.otherId === row.id).length,
              },
            }
          : { id: row.id, name: row.name },
      );
    },
    updateMany: async ({ where, data }: { where: Where; data: { name: string } }) => {
      const rows = this.sections.filter(
        (row) => row.id === where.id && row.userId === where.userId,
      );
      rows.forEach((row) => (row.name = data.name));
      return { count: rows.length };
    },
    deleteMany: async ({ where }: { where: Where }) => {
      const doomed = this.sections.filter(
        (row) => row.id === where.id && row.userId === where.userId,
      );
      this.sections = this.sections.filter((row) => !doomed.includes(row));
      for (const row of doomed) {
        this.itemSections = this.itemSections.filter((join) => join.otherId !== row.id);
      }
      return { count: doomed.length };
    },
  };

  tag = {
    create: async ({ data }: { data: { userId: string; name: string } }) => {
      if (this.tags.some((row) => row.userId === data.userId && row.name === data.name)) {
        // Thrown as the real Prisma error so TagService's instanceof guard —
        // the thing under test — actually engages.
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        });
      }

      const row: TagRow = { id: this.id("tag"), userId: data.userId, name: data.name };
      this.tags.push(row);
      return row;
    },
    findUniqueOrThrow: async ({ where }: { where: Where }) => {
      const { userId, name } = where.userId_name!;
      const found = this.tags.find((row) => row.userId === userId && row.name === name);
      if (!found) throw new Error(`No tag ${name}`);
      return found;
    },
    findMany: async ({ where }: { where: Where }) =>
      this.tags
        .filter((row) => row.userId === where.userId)
        .map((row) => ({
          id: row.id,
          name: row.name,
          _count: { items: this.itemTags.filter((join) => join.otherId === row.id).length },
        })),
    deleteMany: async ({ where }: { where: Where }) => {
      const doomed = this.tags.filter((row) => row.id === where.id && row.userId === where.userId);
      this.tags = this.tags.filter((row) => !doomed.includes(row));
      return { count: doomed.length };
    },
  };

  itemSection = {
    createMany: async ({ data }: { data: { itemId: string; sectionId: string }[] }) => {
      for (const entry of data) {
        const exists = this.itemSections.some(
          (join) => join.itemId === entry.itemId && join.otherId === entry.sectionId,
        );
        if (!exists) this.itemSections.push({ itemId: entry.itemId, otherId: entry.sectionId });
      }
      return { count: data.length };
    },
    deleteMany: async ({ where }: { where: { itemId: string } }) => {
      const before = this.itemSections.length;
      this.itemSections = this.itemSections.filter((join) => join.itemId !== where.itemId);
      return { count: before - this.itemSections.length };
    },
  };

  itemTag = {
    createMany: async ({ data }: { data: { itemId: string; tagId: string }[] }) => {
      for (const entry of data) {
        const exists = this.itemTags.some(
          (join) => join.itemId === entry.itemId && join.otherId === entry.tagId,
        );
        if (!exists) this.itemTags.push({ itemId: entry.itemId, otherId: entry.tagId });
      }
      return { count: data.length };
    },
    deleteMany: async ({ where }: { where: { itemId: string } }) => {
      const before = this.itemTags.length;
      this.itemTags = this.itemTags.filter((join) => join.itemId !== where.itemId);
      return { count: before - this.itemTags.length };
    },
  };

  note = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { itemId: string };
      create: { itemId: string; body: string };
      update: { body: string };
    }) => {
      const existing = this.notes.find((row) => row.itemId === where.itemId);

      if (existing) {
        existing.body = update.body;
        return existing;
      }

      const row: NoteRow = {
        id: this.id("note"),
        itemId: create.itemId,
        body: create.body,
        createdAt: new Date(),
      };
      this.notes.push(row);
      return row;
    },
    deleteMany: async ({ where }: { where: { itemId: string } }) => {
      const before = this.notes.length;
      this.notes = this.notes.filter((row) => row.itemId !== where.itemId);
      return { count: before - this.notes.length };
    },
  };
}
