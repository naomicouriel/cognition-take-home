import { beforeAll, describe, expect, it } from "vitest";
import { REVIEWER, STAFF } from "./setup";
import { db, mutate, runWithActor } from "@/platform/data";
import { ForbiddenError, authorize } from "@/platform/rbac";
import { piiPolicy } from "@/platform/manifest/registry";

const COMPLIANCE = {
  id: "test-compliance",
  email: "compliance@test.local",
  role: "compliance_reviewer" as const,
};

const reference = `KYC-TEST-${Date.now()}`;
let caseId: string;

describe("KYC review queue", () => {
  beforeAll(async () => {
    const created = await mutate({
      actor: COMPLIANCE,
      action: "kyc_case.create",
      resource: "KycCase",
      fn: (tx) =>
        tx.kycCase.create({
          data: {
            reference,
            customerName: "Mariana Ortiz",
            documentNumber: "AR-32.884.117",
            dateOfBirth: new Date("1991-04-12"),
            country: "AR",
            riskLevel: "high",
            riskNotes: "PEP screening hit.",
            documents: {
              create: [
                { kind: "passport", fileName: "passport.pdf", issuer: "RENAPER" },
              ],
            },
          },
        }),
    });
    caseId = created.id;
  });

  it("declares the case PII fields in the manifest policy", () => {
    expect(piiPolicy().KycCase).toEqual({
      customerName: "pii.customer_name",
      documentNumber: "pii.kyc_document_number",
      dateOfBirth: "pii.date_of_birth",
    });
  });

  it("does not leak directory national IDs to the compliance reviewer", async () => {
    const user = await runWithActor(COMPLIANCE, () =>
      db.user.findFirst({ where: { email: "staff@example.com" } }),
    );
    expect(user).not.toHaveProperty("nationalId");
  });

  it("strips PII server side for a role that may read the queue", async () => {
    const asReviewer = await runWithActor(REVIEWER, () =>
      db.kycCase.findUnique({ where: { id: caseId } }),
    );
    expect(asReviewer).toMatchObject({ reference, riskLevel: "high" });
    expect(asReviewer).not.toHaveProperty("customerName");
    expect(asReviewer).not.toHaveProperty("documentNumber");
    expect(asReviewer).not.toHaveProperty("dateOfBirth");
    expect(JSON.stringify(asReviewer)).not.toContain("Mariana");
  });

  it("gives the compliance reviewer the real values", async () => {
    const asCompliance = await runWithActor(COMPLIANCE, () =>
      db.kycCase.findUnique({ where: { id: caseId } }),
    );
    expect(asCompliance?.customerName).toBe("Mariana Ortiz");
    expect(asCompliance?.documentNumber).toBe("AR-32.884.117");
  });

  it("refuses the queue entirely to roles without the read permission", async () => {
    await expect(
      runWithActor(STAFF, () => db.kycCase.findMany()),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("restricts the decision to the compliance reviewer role", () => {
    expect(() => authorize(COMPLIANCE, "kyc_review.decide")).not.toThrow();
    expect(() => authorize(REVIEWER, "kyc_review.decide")).toThrow(ForbiddenError);
    expect(() => authorize(STAFF, "kyc_review.decide")).toThrow(ForbiddenError);
  });

  it("audits the decision with before and after state", async () => {
    await mutate({
      actor: COMPLIANCE,
      action: "kyc_case.reject",
      resource: "KycCase",
      resourceId: caseId,
      fn: (tx) =>
        tx.kycCase.update({
          where: { id: caseId },
          data: {
            status: "rejected",
            decidedAt: new Date(),
            decidedByEmail: COMPLIANCE.email,
            decisionNote: "Screening hit unresolved.",
          },
        }),
    });

    const entry = await runWithActor(COMPLIANCE, () =>
      db.auditLog.findFirst({
        where: { resource: "KycCase", resourceId: caseId, action: "kyc_case.reject" },
        orderBy: { at: "desc" },
      }),
    );
    expect(entry?.actorEmail).toBe(COMPLIANCE.email);
    expect(entry?.before).toMatchObject({ status: "pending" });
    expect(entry?.after).toMatchObject({ status: "rejected" });
  });

  it("refuses a second decision on an already decided case", async () => {
    await expect(
      mutate({
        actor: COMPLIANCE,
        action: "kyc_case.approve",
        resource: "KycCase",
        resourceId: caseId,
        fn: (tx) =>
          tx.kycCase.update({
            where: { id: caseId, status: "pending" },
            data: { status: "approved" },
          }),
      }),
    ).rejects.toThrow();
  });
});
