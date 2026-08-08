import { supabase } from "@/lib/supabase-client";
import { syncProductToWooCommerce, type WooProductSyncResult } from "@/lib/api/woocommerce";

export type WooSyncJobStatus = "pending" | "running" | "synced" | "failed" | "canceled";

export type WooSyncJobProduct = {
  nombre: string;
  categoria: string | null;
  detalles: {
    woocommerce?: {
      productId?: number;
      permalink?: string | null;
      lastSyncedAt?: string;
      imageSyncStatus?: string;
      imageSyncMessage?: string;
    };
  } | null;
};

export type WooSyncJob = {
  id: string;
  product_id: string;
  action: "upsert";
  status: WooSyncJobStatus;
  attempts: number;
  max_attempts: number;
  requested_by: string | null;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
  last_error: string | null;
  result: WooProductSyncResult | null;
  muebles?: WooSyncJobProduct | WooSyncJobProduct[] | null;
};

export type WooSyncJobSummary = {
  pending: number;
  running: number;
  synced: number;
  failed: number;
  canceled: number;
};

const JOB_SELECT = `
  id,
  product_id,
  action,
  status,
  attempts,
  max_attempts,
  requested_by,
  requested_at,
  started_at,
  finished_at,
  updated_at,
  last_error,
  result,
  muebles (
    nombre,
    categoria,
    detalles
  )
`;

function asWooSyncJob(row: unknown): WooSyncJob {
  return row as WooSyncJob;
}

function summarizeJobs(jobs: WooSyncJob[]): WooSyncJobSummary {
  return jobs.reduce<WooSyncJobSummary>(
    (summary, job) => {
      summary[job.status] += 1;
      return summary;
    },
    { pending: 0, running: 0, synced: 0, failed: 0, canceled: 0 },
  );
}

export async function getWooSyncJobs(limit = 25) {
  const { data, error } = await supabase
    .from("woocommerce_sync_jobs")
    .select(JOB_SELECT)
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const jobs = (data ?? []).map(asWooSyncJob);
  return {
    jobs,
    summary: summarizeJobs(jobs),
  };
}

async function getActiveJobForProduct(productId: string) {
  const { data, error } = await supabase
    .from("woocommerce_sync_jobs")
    .select(JOB_SELECT)
    .eq("product_id", productId)
    .in("status", ["pending", "running"])
    .order("requested_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? asWooSyncJob(data) : null;
}

export async function enqueueWooSyncJob(productId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const requestedBy = userData.user?.id ?? null;

  const { data, error } = await supabase
    .from("woocommerce_sync_jobs")
    .insert({
      product_id: productId,
      action: "upsert",
      requested_by: requestedBy,
    })
    .select(JOB_SELECT)
    .single();

  if (!error) return asWooSyncJob(data);

  if (error.code === "23505") {
    const activeJob = await getActiveJobForProduct(productId);
    if (activeJob) return activeJob;
  }

  throw new Error(error.message);
}

export async function retryWooSyncJob(jobId: string) {
  const { data, error } = await supabase
    .from("woocommerce_sync_jobs")
    .update({
      status: "pending",
      started_at: null,
      finished_at: null,
      last_error: null,
      result: null,
    })
    .eq("id", jobId)
    .eq("status", "failed")
    .select(JOB_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return asWooSyncJob(data);
}

async function claimJob(job: WooSyncJob) {
  const { data, error } = await supabase
    .from("woocommerce_sync_jobs")
    .update({
      status: "running",
      attempts: job.attempts + 1,
      started_at: new Date().toISOString(),
      finished_at: null,
      last_error: null,
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select(JOB_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return asWooSyncJob(data);
}

export async function getNextPendingWooSyncJob() {
  const { data, error } = await supabase
    .from("woocommerce_sync_jobs")
    .select(JOB_SELECT)
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? asWooSyncJob(data) : null;
}

export async function processWooSyncJob(job: WooSyncJob) {
  const runningJob = job.status === "running" ? job : await claimJob(job);
  const result = await syncProductToWooCommerce(runningJob.product_id);
  const nextStatus: WooSyncJobStatus = result.success ? "synced" : "failed";

  const { data, error } = await supabase
    .from("woocommerce_sync_jobs")
    .update({
      status: nextStatus,
      finished_at: new Date().toISOString(),
      last_error: result.success ? null : result.message,
      result,
    })
    .eq("id", runningJob.id)
    .select(JOB_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return asWooSyncJob(data);
}

export async function processNextWooSyncJob() {
  const nextJob = await getNextPendingWooSyncJob();
  if (!nextJob) return null;
  return processWooSyncJob(nextJob);
}

export async function enqueueAndProcessWooSyncJob(productId: string) {
  const job = await enqueueWooSyncJob(productId);
  if (job.status !== "pending") return job;
  return processWooSyncJob(job);
}

export async function processPendingWooSyncJobs(limit = 10) {
  const processed: WooSyncJob[] = [];

  for (let index = 0; index < limit; index += 1) {
    const job = await processNextWooSyncJob();
    if (!job) break;
    processed.push(job);
  }

  return processed;
}
