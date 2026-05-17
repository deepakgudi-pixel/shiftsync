const { query } = require("../db/client");
const PgBoss = require("pg-boss");

let bossPromise = null;

const PAY_PERIOD_PROCESSED_FANOUT = "PAY_PERIOD_PROCESSED_FANOUT";

const getBoss = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to start the background job queue");
  }

  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({
        connectionString: process.env.DATABASE_URL,
        schema: "pgboss",
      });
      boss.on("error", (error) => console.error("pg-boss error:", error));
      await boss.start();
      return boss;
    })();
  }

  return bossPromise;
};

const enqueueJob = async ({ client = null, organisationId, type, payload = {}, runAfter = null }) => {
  const runner = client || { query: (text, params) => query(text, params) };
  const result = await runner.query(
    `INSERT INTO background_jobs (organisation_id, type, payload, run_after)
     VALUES ($1, $2, $3, COALESCE($4, NOW()))
     RETURNING *`,
    [organisationId, type, JSON.stringify(payload), runAfter]
  );
  return result.rows[0] || {
    organisation_id: organisationId,
    type,
    payload,
  };
};

const publishQueuedJob = async (job) => {
  if (!job || process.env.NODE_ENV === "test") return null;
  if (!process.env.DATABASE_URL) {
    console.warn("Skipping background job publish because DATABASE_URL is not configured");
    return null;
  }

  const boss = await getBoss();
  const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
  return boss.send(job.type, {
    ...payload,
    backgroundJobId: job.id,
    organisationId: job.organisation_id,
  });
};

const updateJobStatus = async (jobId, status, lastError = null) => {
  if (!jobId) return;

  await query(
    `UPDATE background_jobs
     SET status=$1,
         attempts = attempts + CASE WHEN $1 = 'RUNNING' THEN 1 ELSE 0 END,
         locked_at = CASE WHEN $1 = 'RUNNING' THEN NOW() ELSE locked_at END,
         last_error = $2,
         updated_at = NOW()
     WHERE id=$3`,
    [status, lastError, jobId]
  );
};

module.exports = {
  PAY_PERIOD_PROCESSED_FANOUT,
  enqueueJob,
  getBoss,
  publishQueuedJob,
  updateJobStatus,
};

export {};
