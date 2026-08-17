import { hashPassword } from "@/platform/auth/password";
import { db, mutate, runAsSystem } from "@/platform/data";
import { SYSTEM_ACTOR } from "@/platform/rbac";

type SeedCase = {
  reference: string;
  customerName: string;
  documentNumber: string;
  dateOfBirth: string;
  country: string;
  riskLevel: "low" | "medium" | "high";
  riskNotes: string;
  status?: "pending" | "approved" | "rejected";
  decidedByEmail?: string;
  decisionNote?: string;
  documents: Array<{ kind: string; fileName: string; issuer: string }>;
};

const CASES: SeedCase[] = [
  {
    reference: "KYC-2026-0141",
    customerName: "Mariana Ortiz",
    documentNumber: "AR-32.884.117",
    dateOfBirth: "1991-04-12",
    country: "AR",
    riskLevel: "low",
    riskNotes: "Domestic retail account, salary inflows only, no adverse media.",
    documents: [
      { kind: "national_id", fileName: "dni-front-back.pdf", issuer: "RENAPER" },
      { kind: "proof_of_address", fileName: "utility-bill-mar-2026.pdf", issuer: "Edenor" },
      { kind: "selfie", fileName: "liveness-capture.jpg", issuer: "Onfido" },
    ],
  },
  {
    reference: "KYC-2026-0142",
    customerName: "Tobias Lindqvist",
    documentNumber: "SE-8807152391",
    dateOfBirth: "1988-07-15",
    country: "SE",
    riskLevel: "medium",
    riskNotes: "Cross-border freelance income; document expiry within 90 days.",
    documents: [
      { kind: "passport", fileName: "passport-scan.pdf", issuer: "Swedish Police Authority" },
      { kind: "source_of_funds", fileName: "invoices-2025.pdf", issuer: "Customer upload" },
    ],
  },
  {
    reference: "KYC-2026-0143",
    customerName: "Amara Okonkwo",
    documentNumber: "NG-A04728165",
    dateOfBirth: "1979-11-02",
    country: "NG",
    riskLevel: "high",
    riskNotes:
      "PEP screening hit (state-level official, 2019-2023). Requires enhanced due diligence.",
    documents: [
      { kind: "passport", fileName: "passport-bio-page.pdf", issuer: "Nigeria Immigration Service" },
      { kind: "proof_of_address", fileName: "bank-statement-feb-2026.pdf", issuer: "GTBank" },
      { kind: "source_of_funds", fileName: "property-sale-deed.pdf", issuer: "Lagos Land Registry" },
    ],
  },
  {
    reference: "KYC-2026-0144",
    customerName: "Hiroshi Tanaka",
    documentNumber: "JP-TK9921047",
    dateOfBirth: "1965-02-28",
    country: "JP",
    riskLevel: "low",
    riskNotes: "Long-standing corporate signatory, all documents current.",
    documents: [
      { kind: "passport", fileName: "passport-scan.pdf", issuer: "MOFA Japan" },
      { kind: "proof_of_address", fileName: "juminhyo.pdf", issuer: "Shibuya Ward Office" },
    ],
  },
  {
    reference: "KYC-2026-0145",
    customerName: "Elena Petrova",
    documentNumber: "BG-7405128834",
    dateOfBirth: "1974-05-12",
    country: "BG",
    riskLevel: "high",
    riskNotes: "Sanctions name match pending manual clearance; address unverified.",
    documents: [
      { kind: "national_id", fileName: "lichna-karta.pdf", issuer: "MVR Bulgaria" },
      { kind: "selfie", fileName: "liveness-capture.jpg", issuer: "Onfido" },
    ],
  },
  {
    reference: "KYC-2026-0146",
    customerName: "Daniel Whitmore",
    documentNumber: "GB-503998214",
    dateOfBirth: "1996-09-30",
    country: "GB",
    riskLevel: "medium",
    riskNotes: "Selfie quality below threshold on first attempt; re-submitted.",
    documents: [
      { kind: "passport", fileName: "passport-scan.pdf", issuer: "HM Passport Office" },
      { kind: "selfie", fileName: "liveness-retry.jpg", issuer: "Onfido" },
    ],
  },
  {
    reference: "KYC-2026-0138",
    customerName: "Sofia Marchetti",
    documentNumber: "IT-CA48213996",
    dateOfBirth: "1983-01-19",
    country: "IT",
    riskLevel: "low",
    riskNotes: "Standard onboarding, screening clear.",
    status: "approved",
    decidedByEmail: "compliance@example.com",
    decisionNote: "Documents consistent, screening clear, approved under standard due diligence.",
    documents: [
      { kind: "national_id", fileName: "carta-identita.pdf", issuer: "Comune di Milano" },
      { kind: "proof_of_address", fileName: "utility-bill-jan-2026.pdf", issuer: "Enel" },
    ],
  },
  {
    reference: "KYC-2026-0139",
    customerName: "Victor Almeida",
    documentNumber: "BR-284.117.905-33",
    dateOfBirth: "1990-08-08",
    country: "BR",
    riskLevel: "high",
    riskNotes: "Document tampering suspected: font mismatch on expiry field.",
    status: "rejected",
    decidedByEmail: "compliance@example.com",
    decisionNote: "Identity document failed forensic check; rejected and referred to fraud team.",
    documents: [
      { kind: "national_id", fileName: "rg-scan.pdf", issuer: "SSP-SP" },
      { kind: "selfie", fileName: "liveness-capture.jpg", issuer: "Onfido" },
    ],
  },
];

/** Sample data for the KYC review queue, written through the audited path. */
export async function seedKycReview() {
  const reviewer = {
    email: "compliance@example.com",
    name: "Camila Compliance",
    role: "compliance_reviewer",
  };
  const existingReviewer = await runAsSystem(() =>
    db.user.findUnique({ where: { email: reviewer.email } }),
  );
  if (!existingReviewer) {
    await mutate({
      actor: SYSTEM_ACTOR,
      action: "user.seed",
      resource: "User",
      fn: (tx) =>
        tx.user.create({
          data: { ...reviewer, passwordHash: hashPassword("password") },
        }),
    });
  }

  const existingCases = await runAsSystem(() => db.kycCase.count());
  if (existingCases > 0) return;

  const now = Date.now();
  for (let index = 0; index < CASES.length; index += 1) {
    const { documents, dateOfBirth, status, ...rest } = CASES[index];
    const decided = status && status !== "pending";
    await mutate({
      actor: SYSTEM_ACTOR,
      action: "kyc_case.seed",
      resource: "KycCase",
      fn: (tx) =>
        tx.kycCase.create({
          data: {
            ...rest,
            dateOfBirth: new Date(dateOfBirth),
            status: status ?? "pending",
            submittedAt: new Date(now - (CASES.length - index) * 86_400_000),
            decidedAt: decided ? new Date(now - 86_400_000) : null,
            documents: { create: documents },
          },
        }),
    });
  }

  console.log(`Seeded ${CASES.length} KYC cases and compliance@example.com.`);
}
