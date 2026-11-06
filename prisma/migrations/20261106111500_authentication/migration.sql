BEGIN;

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activeTenantId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");
CREATE INDEX "RefreshToken_familyId_revokedAt_idx" ON "RefreshToken"("familyId", "revokedAt");

ALTER TABLE "RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefreshToken"
    ADD CONSTRAINT "RefreshToken_activeTenantId_fkey"
    FOREIGN KEY ("activeTenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE POLICY "Membership_user_read" ON "Membership"
    FOR SELECT
    USING ("userId" = NULLIF(current_setting('app.user_id', true), '')::UUID);

COMMIT;
