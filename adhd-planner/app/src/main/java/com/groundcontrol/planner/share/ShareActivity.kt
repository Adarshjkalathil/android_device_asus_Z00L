package com.groundcontrol.planner.share

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import com.groundcontrol.planner.container
import com.groundcontrol.planner.data.Categories
import com.groundcontrol.planner.data.Priorities
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.plan.RulesPlanner
import com.groundcontrol.planner.work.EnrichWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDateTime

/**
 * Capture from anywhere: share a message, a page, a selection, and it lands on the board
 * without the app being opened. Deliberately uses the on-device rules only, so it finishes
 * instantly with no network and no waiting.
 */
class ShareActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = extractText(intent)
        if (text.isNullOrBlank()) {
            Toast.makeText(this, "Nothing to file", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val app = applicationContext
        CoroutineScope(Dispatchers.Main).launch {
            val settings = app.container.settings
            val drafts = withContext(Dispatchers.IO) {
                RulesPlanner(settings.defaultLeadMinutes).split(text, LocalDateTime.now())
            }
            val fresh = drafts.map { draft ->
                Task(
                    text = draft.text,
                    day = draft.day,
                    time = if (draft.day != null) draft.time else null,
                    durationMinutes = draft.durationMinutes,
                    category = Categories.valid(draft.category),
                    priority = Priorities.valid(draft.priority),
                    remindMinutesBefore = if (draft.day != null && draft.time != null) draft.remindMinutesBefore else null,
                    firstStep = draft.firstStep,
                    enriched = false,
                )
            }
            withContext(Dispatchers.IO) { app.container.repository.addAll(fresh) }
            EnrichWorker.runNow(app)
            Toast.makeText(
                app,
                if (fresh.size == 1) "Filed: ${fresh.first().text}" else "Filed ${fresh.size} strips",
                Toast.LENGTH_SHORT,
            ).show()
            finish()
        }
    }

    private fun extractText(intent: Intent?): String? = when (intent?.action) {
        Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT)
            ?: intent.getStringExtra(Intent.EXTRA_SUBJECT)

        Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
        else -> null
    }
}
