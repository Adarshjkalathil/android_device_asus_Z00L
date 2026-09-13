package com.groundcontrol.planner.alarm

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.content.getSystemService
import com.groundcontrol.planner.Settings
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.data.alarmAt
import com.groundcontrol.planner.ui.MainActivity
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Hands the operating system the alarms it should fire.
 *
 * setAlarmClock is deliberate: it is the clock-app tier, exempt from Doze batching, and it
 * shows the alarm icon in the status bar so the phone visibly agrees an alarm is set. This
 * is the thing a web page cannot do at any price.
 */
class AlarmScheduler(private val context: Context) {

    private val manager: AlarmManager? = context.getSystemService()
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Re-lay every alarm from scratch. Cheap, and impossible to leave stale. */
    fun syncAll(tasks: List<Task>) {
        cancelTracked()
        if (!Settings(context).alarmsEnabled) return

        val now = LocalDateTime.now()
        val upcoming = tasks
            .mapNotNull { task -> task.alarmAt()?.let { at -> task to at } }
            .filter { (_, at) -> at.isAfter(now) }
            .sortedBy { it.second }
            .take(MAX_SCHEDULED)

        val scheduled = mutableSetOf<String>()
        for ((task, at) in upcoming) {
            if (schedule(task.id, at)) scheduled += task.id
        }
        prefs.edit().putStringSet(KEY_SCHEDULED, scheduled).apply()
    }

    /** Used by snooze, which needs a one-off that is not derived from the task's own time. */
    fun scheduleAt(taskId: String, at: LocalDateTime) {
        if (schedule(taskId, at)) {
            val current = prefs.getStringSet(KEY_SCHEDULED, emptySet()).orEmpty().toMutableSet()
            current += taskId
            prefs.edit().putStringSet(KEY_SCHEDULED, current).apply()
        }
    }

    fun cancel(taskId: String) {
        manager?.cancel(operationFor(taskId))
        val current = prefs.getStringSet(KEY_SCHEDULED, emptySet()).orEmpty().toMutableSet()
        current -= taskId
        prefs.edit().putStringSet(KEY_SCHEDULED, current).apply()
    }

    /** False on Android 12 and 13 when the user has refused exact alarms outright. */
    fun canScheduleExact(): Boolean {
        val am = manager ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.canScheduleExactAlarms() else true
    }

    @SuppressLint("MissingPermission")
    private fun schedule(taskId: String, at: LocalDateTime): Boolean {
        val am = manager ?: return false
        val triggerAt = at.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        if (triggerAt <= System.currentTimeMillis()) return false
        val operation = operationFor(taskId)
        return try {
            if (canScheduleExact()) {
                val show = PendingIntent.getActivity(
                    context,
                    taskId.hashCode(),
                    Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                am.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, show), operation)
            } else {
                // Still arrives, just without the clock-app guarantees.
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, operation)
            }
            true
        } catch (e: SecurityException) {
            Log.w(TAG, "Exact alarm refused for $taskId: ${e.message}")
            runCatching {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, operation)
            }.isSuccess
        }
    }

    private fun cancelTracked() {
        val am = manager ?: return
        prefs.getStringSet(KEY_SCHEDULED, emptySet()).orEmpty().forEach { id ->
            am.cancel(operationFor(id))
        }
        prefs.edit().remove(KEY_SCHEDULED).apply()
    }

    private fun operationFor(taskId: String): PendingIntent {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmReceiver.ACTION_RING
            putExtra(AlarmReceiver.EXTRA_TASK_ID, taskId)
            // Distinct data keeps the PendingIntents from collapsing into one another.
            data = android.net.Uri.parse("groundcontrol://alarm/$taskId")
        }
        return PendingIntent.getBroadcast(
            context,
            taskId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    companion object {
        private const val TAG = "AlarmScheduler"
        private const val PREFS = "groundcontrol.alarms"
        private const val KEY_SCHEDULED = "scheduled_task_ids"

        /** The OS caps how many alarms one app may hold; the far future can wait. */
        private const val MAX_SCHEDULED = 40
    }
}
