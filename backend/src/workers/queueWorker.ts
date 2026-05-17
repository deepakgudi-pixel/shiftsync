const { query, pool } = require("../db/client");
const {
  PAY_PERIOD_PROCESSED_FANOUT,
  getBoss,
  republishQueuedJobs,
  updateJobStatus,
} = require("../services/jobQueueService");

const notifyGeneratedPayslips = async (payload) => {
  const generated = Array.isArray(payload.generated) ? payload.generated : [];

  await updateJobStatus(payload.backgroundJobId, "RUNNING");

  try {
    for (const item of generated) {
      if (!item.memberId) continue;

      await query(
        `INSERT INTO notifications (member_id, type, title, body, data)
         VALUES ($1, 'PAYSLIP_READY', 'Payslip Ready', $2, $3)`,
        [
          item.memberId,
          "Your payslip for this pay period is ready.",
          JSON.stringify({
            payPeriodId: payload.payPeriodId,
            payslipId: item.id,
            totalEarn: item.totalEarn,
          }),
        ]
      );
    }

    await updateJobStatus(payload.backgroundJobId, "SUCCEEDED");
  } catch (error) {
    await updateJobStatus(payload.backgroundJobId, "FAILED", error.message);
    throw error;
  }
};

const startWorker = async () => {
  const boss = await getBoss();

  await boss.work(PAY_PERIOD_PROCESSED_FANOUT, async (job) => {
    await notifyGeneratedPayslips(job.data || {});
  });

  const republished = await republishQueuedJobs({
    type: PAY_PERIOD_PROCESSED_FANOUT,
    limit: 100,
  });

  if (republished > 0) {
    console.log(`Republished ${republished} queued payroll fan-out job(s)`);
  }

  console.log("Queue worker started");
};

startWorker().catch((error) => {
  console.error("Queue worker failed to start:", error);
  pool.end();
  process.exitCode = 1;
});

export {};
