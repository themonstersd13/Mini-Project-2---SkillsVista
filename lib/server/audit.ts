import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AuditInput = {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  actor: string;
  requestId?: string;
};

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details as Prisma.InputJsonValue,
      actor: input.actor,
      requestId: input.requestId,
    },
  });
}
