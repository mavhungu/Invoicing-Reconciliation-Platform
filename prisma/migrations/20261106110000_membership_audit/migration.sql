BEGIN;

ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
DROP POLICY "User_tenant_isolation" ON "User";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "User"
        GROUP BY "email"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot migrate users to global email identities: duplicate email addresses exist across tenants. Resolve them before retrying.';
    END IF;
END
$$;

CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Membership" ("id", "tenantId", "userId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "tenantId", "id", "role", "createdAt", "updatedAt"
FROM "User";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_tenantId_timestamp_idx" ON "AuditLog"("tenantId", "timestamp");
CREATE INDEX "AuditLog_tenantId_entityType_entityId_idx" ON "AuditLog"("tenantId", "entityType", "entityId");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_fkey";
DROP INDEX "User_tenantId_idx";
DROP INDEX "User_tenantId_email_key";
ALTER TABLE "User" DROP COLUMN "tenantId";
ALTER TABLE "User" DROP COLUMN "role";

ALTER TABLE "Membership"
    ADD CONSTRAINT "Membership_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Membership"
    ADD CONSTRAINT "Membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY "Membership_tenant_isolation" ON "Membership"
    USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY "AuditLog_tenant_isolation" ON "AuditLog"
    USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE FUNCTION "reject_audit_log_mutation"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'AuditLog is append-only'
        USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_no_update_or_delete"
    BEFORE UPDATE OR DELETE ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION "reject_audit_log_mutation"();

CREATE TRIGGER "AuditLog_no_truncate"
    BEFORE TRUNCATE ON "AuditLog"
    FOR EACH STATEMENT EXECUTE FUNCTION "reject_audit_log_mutation"();

COMMIT;
