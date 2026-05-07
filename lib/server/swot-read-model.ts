import { SWOTCategory } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getSwotBoard(userId: string) {
  const items = await prisma.swotItem.findMany({
    where: { userId },
    include: {
      evidence: {
        orderBy: { createdAt: "desc" },
        take: 4,
      },
      versions: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: [{ category: "asc" }, { confidence: "desc" }],
  });

  return {
    strengths: items.filter((item) => item.category === SWOTCategory.STRENGTH),
    weaknesses: items.filter((item) => item.category === SWOTCategory.WEAKNESS),
    opportunities: items.filter((item) => item.category === SWOTCategory.OPPORTUNITY),
    threats: items.filter((item) => item.category === SWOTCategory.THREAT),
  };
}
