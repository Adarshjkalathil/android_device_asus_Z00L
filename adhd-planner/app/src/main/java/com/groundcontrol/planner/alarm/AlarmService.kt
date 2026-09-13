package com.groundcontrol.planner.alarm

import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.getSystemService
import com.groundcontrol.planner.R
import com.groundcontrol.planner.container
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.data.clockLabel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Holds the phone awake and makes noise until a person deals with it.
 *
 * A foreground service is what keeps the sound alive through a screen-off, memory-pressured
 * phone. The notification carries Stop, Snooze and Done so the alarm is answerable without
 * unlocking anything.
 */
class AlarmService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var player: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private var stopRunnable: Runnable? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopEverything()
                return START_NOT_STICKY
            }
        }

        val taskId = intent?.getStringExtra(AlarmReceiver.EXTRA_TASK_ID)
        if (taskId == null) {
            stopEverything()
            return START_NOT_STICKY
        }

        // The five-second rule: show something immediately, fill in the detail after.
        startForegroundSafely(buildNotification(taskId, null))
        acquireWakeLock()
        startRinging()
        scheduleAutoStop()

        scope.launch {
            val task = runCatching { applicationContext.container.repository.byId(taskId) }.getOrNull()
            if (task != null) {
                handler.post { startForegroundSafely(buildNotification(taskId, task)) }
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopRinging()
        releaseWakeLock()
        stopRunnable?.let { handler.removeCallbacks(it) }
        scope.cancel()
        super.onDestroy()
    }

    private fun startForegroundSafely(notification: android.app.Notification) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else {
            0
        }
        runCatching {
            ServiceCompat.startForeground(this, Notifications.NOTIFICATION_ID, notification, type)
        }.onFailure { Log.w(TAG, "Could not go foreground: ${it.message}") }
    }

    private fun buildNotification(taskId: String, task: Task?): android.app.Notification {
        val title = task?.text ?: "Task due"
        val due = task?.time?.let { clockLabel(it) }.orEmpty()
        val body = listOfNotNull(
            due.takeIf { it.isNotBlank() },
            task?.firstStep?.let { "Start by: $it" },
        ).joinToString(" · ").ifBlank { "Time to start." }

        val full = PendingIntent.getActivity(
            this,
            taskId.hashCode(),
            Intent(this, AlarmActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                putExtra(AlarmReceiver.EXTRA_TASK_ID, taskId)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, Notifications.CHANNEL_ALARM)
            .setSmallIcon(R.drawable.ic_alarm)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(full, true)
            .setContentIntent(full)
            .addAction(0, "Done", action(taskId, AlarmActionReceiver.ACTION_DONE))
            .addAction(0, "Snooze 10m", action(taskId, AlarmActionReceiver.ACTION_SNOOZE))
            .addAction(0, "Stop", action(taskId, AlarmActionReceiver.ACTION_STOP))
            .build()
    }

    private fun action(taskId: String, act: String): PendingIntent {
        val intent = Intent(this, AlarmActionReceiver::class.java).apply {
            action = act
            putExtra(AlarmReceiver.EXTRA_TASK_ID, taskId)
            data = Uri.parse("groundcontrol://$act/$taskId")
        }
        return PendingIntent.getBroadcast(
            this,
            (act + taskId).hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun startRinging() {
        if (player != null) return
        val uri: Uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ?: return
        runCatching {
            player = MediaPlayer().apply {
                setDataSource(this@AlarmService, uri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        // USAGE_ALARM plays on the alarm stream, which survives silent mode.
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        }.onFailure { Log.w(TAG, "Alarm tone failed: ${it.message}") }
        vibrate()
    }

    private fun vibrate() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService<VibratorManager>()?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService<Vibrator>()
        } ?: return
        val pattern = longArrayOf(0, 600, 400, 600, 1200)
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, 0)
            }
        }
    }

    private fun stopRinging() {
        runCatching { player?.stop() }
        runCatching { player?.release() }
        player = null
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService<VibratorManager>()?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService<Vibrator>()
        }
        runCatching { vibrator?.cancel() }
    }

    private fun acquireWakeLock() {
        if (wakeLock != null) return
        val power = getSystemService<PowerManager>() ?: return
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "groundcontrol:alarm").apply {
            setReferenceCounted(false)
            runCatching { acquire(RING_LIMIT_MS) }
        }
    }

    private fun releaseWakeLock() {
        runCatching { if (wakeLock?.isHeld == true) wakeLock?.release() }
        wakeLock = null
    }

    /** Never ring forever. A missed alarm leaves the notification behind, not the noise. */
    private fun scheduleAutoStop() {
        stopRunnable?.let { handler.removeCallbacks(it) }
        val runnable = Runnable { stopEverything() }
        stopRunnable = runnable
        handler.postDelayed(runnable, RING_LIMIT_MS)
    }

    private fun stopEverything() {
        stopRinging()
        releaseWakeLock()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        private const val TAG = "AlarmService"
        const val ACTION_START = "com.groundcontrol.planner.ALARM_START"
        const val ACTION_STOP = "com.groundcontrol.planner.ALARM_STOP"
        private const val RING_LIMIT_MS = 2 * 60 * 1000L

        fun stop(context: Context) {
            val intent = Intent(context, AlarmService::class.java).apply { action = ACTION_STOP }
            runCatching { context.startService(intent) }
        }
    }
}
