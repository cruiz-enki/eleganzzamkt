import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  enqueueAndProcessWooSyncJob,
  enqueueWooSyncJob,
  getWooSyncJobs,
  processPendingWooSyncJobs,
  processWooSyncJob,
  retryWooSyncJob,
  type WooSyncJob,
} from "@/lib/api/woocommerce-sync-queue";

export const wooSyncQueueQueryKey = ["woocommerce-sync-queue"];

export function useWooCommerceSyncQueue() {
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: wooSyncQueueQueryKey,
    queryFn: () => getWooSyncJobs(),
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });

  const invalidateQueue = async () => {
    await queryClient.invalidateQueries({ queryKey: wooSyncQueueQueryKey });
    await queryClient.invalidateQueries({ queryKey: ["supabase-inventory"] });
  };

  const enqueue = useMutation({
    mutationFn: enqueueWooSyncJob,
    onSuccess: invalidateQueue,
  });

  const enqueueAndProcess = useMutation({
    mutationFn: enqueueAndProcessWooSyncJob,
    onSuccess: invalidateQueue,
  });

  const processJob = useMutation({
    mutationFn: (job: WooSyncJob) => processWooSyncJob(job),
    onSuccess: invalidateQueue,
  });

  const processPending = useMutation({
    mutationFn: processPendingWooSyncJobs,
    onSuccess: invalidateQueue,
  });

  const retry = useMutation({
    mutationFn: retryWooSyncJob,
    onSuccess: invalidateQueue,
  });

  const isWorking =
    enqueue.isPending ||
    enqueueAndProcess.isPending ||
    processJob.isPending ||
    processPending.isPending ||
    retry.isPending;

  return {
    queue,
    enqueue,
    enqueueAndProcess,
    processJob,
    processPending,
    retry,
    isWorking,
  };
}
