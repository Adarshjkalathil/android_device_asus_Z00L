package com.groundcontrol.planner.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.groundcontrol.planner.container
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDateTime

/** Stop, snooze and done, answerable straight from the notification. */
class AlarmActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(AlarmReceiver.EXTRA_TASK_ID)
        val app = context.applicationContext
        AlarmService.stop(app)

        when (intent.action) {
            ACTION_SNOOZE -> {
                if (taskId != null) {
                    AlarmScheduler(app).scheduleAt(taskId, LocalDateTime.now().plusMinutes(SNOOZE_MINUTES))
                }
            }

            ACTION_DONE -> {
                if (taskId != null) {
                    val pending = goAsync()
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            app.container.repository.setDone(taskId, true)
                        } finally {
                            pending.finish()
                        }
                    }
                }
            }
        }
    }

    companion object {
        const val ACTION_STOP = "com.groundcontrol.planner.action.STOP"
        const val ACTION_SNOOZE = "com.groundcontrol.planner.action.SNOOZE"
        const val ACTION_DONE = "com.groundcontrol.planner.action.DONE"
        const val SNOOZE_MINUTES = 10L
    }
}
