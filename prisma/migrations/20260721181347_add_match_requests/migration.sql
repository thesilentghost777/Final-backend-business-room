-- CreateEnum
CREATE TYPE "MatchRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'MEETING_SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MatchRequest" (
    "id" TEXT NOT NULL,
    "investorProfileId" TEXT NOT NULL,
    "entrepreneurProfileId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "status" "MatchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "meetingScheduledAt" TIMESTAMP(3),
    "meetingLocation" TEXT,
    "meetingNotes" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchRequest_investorProfileId_idx" ON "MatchRequest"("investorProfileId");

-- CreateIndex
CREATE INDEX "MatchRequest_entrepreneurProfileId_idx" ON "MatchRequest"("entrepreneurProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRequest_investorProfileId_entrepreneurProfileId_key" ON "MatchRequest"("investorProfileId", "entrepreneurProfileId");

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_investorProfileId_fkey" FOREIGN KEY ("investorProfileId") REFERENCES "InvestorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_entrepreneurProfileId_fkey" FOREIGN KEY ("entrepreneurProfileId") REFERENCES "EntrepreneurProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
