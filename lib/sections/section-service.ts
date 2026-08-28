import { prisma } from "@/lib/db";

export interface SectionSummary {
  id: string;
  name: string;
  itemCount: number;
}

class SectionService {
  async create(userId: string, name: string) {
    return prisma.section.create({
      data: { userId, name },
      select: { id: true, name: true, createdAt: true },
    });
  }

  async list(userId: string): Promise<SectionSummary[]> {
    const sections = await prisma.section.findMany({
      where: { userId },
      select: { id: true, name: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "asc" },
    });

    return sections.map((section) => ({
      id: section.id,
      name: section.name,
      itemCount: section._count.items,
    }));
  }

  async rename(userId: string, sectionId: string, name: string) {
    const { count } = await prisma.section.updateMany({
      where: { id: sectionId, userId },
      data: { name },
    });

    return count > 0 ? { id: sectionId, name } : null;
  }

  // Deletes the Section row itself. onDelete: Cascade on ItemSection's
  // section relation cleans up the join rows, but Item rows have no
  // cascade path from Section, so they stay untouched and remain visible
  // in the computed "General" view (all items for user_id, no join row).
  async remove(userId: string, sectionId: string): Promise<boolean> {
    const { count } = await prisma.section.deleteMany({
      where: { id: sectionId, userId },
    });

    return count > 0;
  }
}

export const sectionService = new SectionService();
