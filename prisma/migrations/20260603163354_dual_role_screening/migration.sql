-- Clear test data so we can safely restructure the schema
TRUNCATE TABLE "ScreeningResult" CASCADE;
TRUNCATE TABLE "Candidate" CASCADE;

-- Drop old unique constraint on ScreeningResult.candidateId (1-to-1)
DROP INDEX IF EXISTS "ScreeningResult_candidateId_key";

-- Drop role column from Candidate (role now lives on ScreeningResult)
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "role";

-- Add role column to ScreeningResult (safe now that table is empty)
ALTER TABLE "ScreeningResult" ADD COLUMN "role" "Role" NOT NULL;

-- Add composite unique constraint: one result per role per candidate
CREATE UNIQUE INDEX "ScreeningResult_candidateId_role_key" ON "ScreeningResult"("candidateId", "role");
