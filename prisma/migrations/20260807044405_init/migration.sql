-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "processor_code" TEXT NOT NULL,
    "processor_application_id" TEXT,
    "webhook_url" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "http_status" INTEGER,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_logs" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_code_key" ON "applications"("code");

-- CreateIndex
CREATE INDEX "transactions_application_id_idx" ON "transactions"("application_id");

-- CreateIndex
CREATE INDEX "transactions_processor_application_id_idx" ON "transactions"("processor_application_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "webhook_logs_transaction_id_idx" ON "webhook_logs"("transaction_id");

-- CreateIndex
CREATE INDEX "transaction_logs_transaction_id_idx" ON "transaction_logs"("transaction_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_processor_application_id_fkey" FOREIGN KEY ("processor_application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_logs" ADD CONSTRAINT "transaction_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
