package com.groundcontrol.planner.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.groundcontrol.planner.container
import java.util.concurrent.TimeUnit

/**
 * Capture is instant and offline. The nice-to-haves, a better category and a first step,
 * are filled in afterwards whenever the network happens to be there. Nothing is ever lost
 * or blocked waiting for them.
 */
class EnrichWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val repo = applicationContext.container.repository
        val planner = applicationContext.container.planner
        val pending = runCatching { repo.needingEnrichment() }.getOrNull() ?: return Result.retry()
        if (pending.isEmpty()) return Result.success()

        for (task in pending) {
            val patch = runCatching { planner.enrich(task) }.getOrNull()
            val updated = patch?.applyTo(task) ?: task
            runCatching { repo.saveEnriched(updated) }
        }
        return Result.success()
    }

    companion object {
        private const val UNIQUE_PERIODIC = "enrich-periodic"
        private const val UNIQUE_NOW = "enrich-now"

        fun ensureScheduled(context: Context) {
            val request = PeriodicWorkRequestBuilder<EnrichWorker>(6, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(UNIQUE_PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun runNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<EnrichWorker>().build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(UNIQUE_NOW, ExistingWorkPolicy.REPLACE, request)
        }
    }
}
