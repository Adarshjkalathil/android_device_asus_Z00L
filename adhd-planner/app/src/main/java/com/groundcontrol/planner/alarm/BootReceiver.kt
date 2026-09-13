package com.groundcontrol.planner.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.groundcontrol.planner.container
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Alarms do not survive a reboot, a reinstall, or a clock change on their own.
 * Every one of those events re-lays the whole set.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val app = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                AlarmScheduler(app).syncAll(app.container.repository.all())
            } finally {
                pending.finish()
            }
        }
    }
}
