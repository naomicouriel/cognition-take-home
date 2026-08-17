-- CreateTable
CREATE TABLE "KycCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "country" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "riskLevel" TEXT NOT NULL,
    "riskNotes" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByEmail" TEXT,
    "decisionNote" TEXT,

    CONSTRAINT "KycCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycCase_reference_key" ON "KycCase"("reference");

-- CreateIndex
CREATE INDEX "KycCase_status_riskLevel_idx" ON "KycCase"("status", "riskLevel");

-- CreateIndex
CREATE INDEX "KycDocument_caseId_idx" ON "KycDocument"("caseId");

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
