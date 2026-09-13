package com.groundcontrol.planner.alarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.content.getSystemService

object Notifications {

    const val CHANNEL_ALARM = "groundcontrol.alarm"
    const val NOTIFICATION_ID = 4711

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService<NotificationManager>() ?: return
        val channel = NotificationChannel(
            CHANNEL_ALARM,
            "Task alarms",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Rings when a task is due, even on a locked screen."
            // The service plays the alarm tone itself, so the channel stays silent.
            setSound(null, null)
            enableVibration(false)
            setBypassDnd(true)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }
}
