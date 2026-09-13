package com.groundcontrol.planner.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** The alarm went off. Hand straight over to the service that can hold a wake lock. */
class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_RING) return
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
        val service = Intent(context, AlarmService::class.java).apply {
            action = AlarmService.ACTION_START
            putExtra(EXTRA_TASK_ID, taskId)
        }
        ContextCompat.startForegroundService(context, service)
    }

    companion object {
        const val ACTION_RING = "com.groundcontrol.planner.RING"
        const val EXTRA_TASK_ID = "task_id"
    }
}
