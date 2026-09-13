package com.groundcontrol.planner.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.groundcontrol.planner.R
import com.groundcontrol.planner.container
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.data.clockLabel
import com.groundcontrol.planner.data.durationLabel
import com.groundcontrol.planner.data.isLate
import com.groundcontrol.planner.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/**
 * The one thing that is next, on the home screen, with no app to open. For a brain that
 * forgets the plan exists, a widget is worth more than any feature inside the app.
 */
class NextUpWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val pending = goAsync()
        val app = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val task = pickNext(runCatching { app.container.repository.all() }.getOrDefault(emptyList()))
                val views = render(app, task)
                ids.forEach { manager.updateAppWidget(it, views) }
            } finally {
                pending.finish()
            }
        }
    }

    private fun render(context: Context, task: Task?): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_next_up)
        views.setTextViewText(R.id.widget_text, task?.text ?: "Nothing on today")
        views.setTextViewText(
            R.id.widget_meta,
            when {
                task == null -> "Tap to add something"
                else -> listOfNotNull(
                    task.time?.let { clockLabel(it) },
                    durationLabel(task.durationMinutes).takeIf { it.isNotBlank() },
                    task.firstStep,
                ).joinToString(" · ")
            },
        )
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.widget_root, open)
        return views
    }

    private fun pickNext(all: List<Task>): Task? {
        val today = LocalDate.now()
        val open = all.filter { !it.done && (it.day == today.format(DateTimeFormatter.ISO_LOCAL_DATE) || it.isLate(today)) }
        if (open.isEmpty()) return null
        val now = LocalTime.now()
        val timed = open.filter { it.time != null }.sortedBy { it.time }
        timed.firstOrNull { task ->
            val t = runCatching { LocalTime.parse(task.time.orEmpty()) }.getOrNull()
            t != null && !t.isBefore(now)
        }?.let { return it }
        open.firstOrNull { it.isLate(today) }?.let { return it }
        return open.firstOrNull { it.time == null } ?: timed.firstOrNull() ?: open.first()
    }

    companion object {
        /** Called after every write so the home screen never shows a stale plan. */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(context, NextUpWidget::class.java))
            if (ids.isEmpty()) return
            val intent = Intent(context, NextUpWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }
}
