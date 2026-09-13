package com.groundcontrol.planner.plan

import android.util.Log
import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.OutputConfig
import com.groundcontrol.planner.data.Categories
import com.groundcontrol.planner.data.Priorities
import com.groundcontrol.planner.data.Task
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * The optional half. It earns its place on wording and on first steps, which are judgement
 * calls; it is not trusted with date arithmetic, because [RulesPlanner] is simply better at
 * that and needs no network. Any failure here returns null and the caller falls back.
 */
class ClaudePlanner(private val apiKey: String) : Planner {

    override val label: String = "Claude"

    private val stamp = DateTimeFormatter.ofPattern("EEEE, yyyy-MM-dd 'at' HH:mm")

    override suspend fun split(dump: String, now: LocalDateTime): List<TaskDraft> {
        val reply = ask(
            """
            It is ${now.format(stamp)}.
            The person writing this has ADHD. They need the pile broken into small, concrete,
            startable pieces, in their own words where those already work.

            Turn the brain dump below into a JSON array of task objects. Split compound items apart.

            Fields per object:
            "text": short action, imperative, at most about 70 characters
            "day": "YYYY-MM-DD" when a date, weekday or relative day is stated or clearly implied, else null
            "time": "HH:MM" 24-hour when a clock time is stated, else null
            "duration_minutes": integer, always your honest estimate between 5 and 240
            "category": one of "work","personal","health","errands","social","other"
            "priority": "high" only for real urgency or a real deadline, "low" for optional, else "medium"
            "remind_minutes_before": integer only when they ask to be reminded a set time ahead, else omit
            "first_step": one tiny concrete physical first action, at most about 60 characters

            Reply with ONLY the JSON array.

            BRAIN DUMP:
            $dump
            """.trimIndent()
        ) ?: return emptyList()

        val array = extractArray(reply) ?: return emptyList()
        return (0 until array.length()).mapNotNull { i ->
            val o = array.optJSONObject(i) ?: return@mapNotNull null
            val text = o.optStringOrNull("text") ?: return@mapNotNull null
            TaskDraft(
                text = text.take(240),
                day = o.optStringOrNull("day")?.takeIf { ISO_DAY_PATTERN.matches(it) },
                time = o.optStringOrNull("time")?.let { normalizeTime(it) },
                durationMinutes = o.optIntOrNull("duration_minutes")?.coerceIn(5, 480),
                category = Categories.valid(o.optStringOrNull("category")),
                priority = Priorities.valid(o.optStringOrNull("priority")),
                remindMinutesBefore = o.optIntOrNull("remind_minutes_before")?.coerceIn(0, 10080),
                firstStep = o.optStringOrNull("first_step")?.take(180),
            )
        }
    }

    override suspend fun amend(task: Task, words: String, now: LocalDateTime): TaskPatch? {
        val snapshot = JSONObject().apply {
            put("text", task.text)
            put("day", task.day ?: JSONObject.NULL)
            put("time", task.time ?: JSONObject.NULL)
            put("duration_minutes", task.durationMinutes ?: JSONObject.NULL)
            put("remind_minutes_before", task.remindMinutesBefore ?: JSONObject.NULL)
            put("category", task.category)
            put("priority", task.priority)
            put("first_step", task.firstStep ?: JSONObject.NULL)
        }
        val reply = ask(
            """
            It is ${now.format(stamp)}.
            You are amending ONE task already on a planner board. Here it is as JSON:
            $snapshot

            The person wants this change, in their own words:
            $words

            Reply with ONLY a JSON object holding the fields that should change. Leave out every
            field that stays the same.
            "text": the reworded task, imperative, at most about 70 characters
            "day": "YYYY-MM-DD" resolved against today, or null to take it off the calendar
            "time": "HH:MM" 24-hour, or null to clear the time
            "duration_minutes": integer between 5 and 480
            "remind_minutes_before": minutes before the time to ring, 0 meaning exactly on time, or null for no alarm
            "category": one of "work","personal","health","errands","social","other"
            "priority": "high", "medium" or "low"
            "first_step": one tiny concrete physical first action

            If the rewording makes the old first step wrong, give a new first_step too.
            """.trimIndent()
        ) ?: return null

        val o = extractObject(reply) ?: return null
        var patch = TaskPatch()
        o.optStringOrNull("text")?.let { patch = patch.copy(text = Change(it.take(240))) }
        if (o.has("day")) {
            if (o.isNull("day")) patch = patch.copy(day = Change(null))
            else o.optStringOrNull("day")?.takeIf { ISO_DAY_PATTERN.matches(it) }
                ?.let { patch = patch.copy(day = Change(it)) }
        }
        if (o.has("time")) {
            if (o.isNull("time")) patch = patch.copy(time = Change(null))
            else o.optStringOrNull("time")?.let { normalizeTime(it) }
                ?.let { patch = patch.copy(time = Change(it)) }
        }
        if (o.has("duration_minutes")) {
            o.optIntOrNull("duration_minutes")?.let {
                patch = patch.copy(durationMinutes = Change(it.coerceIn(5, 480)))
            }
        }
        if (o.has("remind_minutes_before")) {
            if (o.isNull("remind_minutes_before")) patch = patch.copy(remindMinutesBefore = Change(null))
            else o.optIntOrNull("remind_minutes_before")
                ?.let { patch = patch.copy(remindMinutesBefore = Change(it.coerceIn(0, 10080))) }
        }
        o.optStringOrNull("category")?.takeIf { it in Categories.all }
            ?.let { patch = patch.copy(category = Change(it)) }
        o.optStringOrNull("priority")?.takeIf { it in Priorities.all }
            ?.let { patch = patch.copy(priority = Change(it)) }
        if (o.has("first_step")) {
            if (o.isNull("first_step")) patch = patch.copy(firstStep = Change(null))
            else o.optStringOrNull("first_step")?.let { patch = patch.copy(firstStep = Change(it.take(180))) }
        }
        return if (patch.isEmpty) null else patch
    }

    override suspend fun enrich(task: Task): TaskPatch? {
        val reply = ask(
            """
            A person with ADHD has this task on their board: "${task.text}"

            Reply with ONLY a JSON object:
            "category": one of "work","personal","health","errands","social","other"
            "first_step": one tiny concrete physical first action that starts this task, at most
            about 60 characters. It must be something they could do in under a minute without
            deciding anything, for example "Open the spreadsheet and find row 14". Never write a
            restatement such as "Start the task".
            """.trimIndent()
        ) ?: return null

        val o = extractObject(reply) ?: return null
        var patch = TaskPatch()
        if (task.category == Categories.OTHER) {
            o.optStringOrNull("category")?.takeIf { it in Categories.all && it != Categories.OTHER }
                ?.let { patch = patch.copy(category = Change(it)) }
        }
        if (task.firstStep.isNullOrBlank()) {
            o.optStringOrNull("first_step")?.take(180)?.let { patch = patch.copy(firstStep = Change(it)) }
        }
        return if (patch.isEmpty) null else patch
    }

    private suspend fun ask(prompt: String): String? = withContext(Dispatchers.IO) {
        try {
            val params = MessageCreateParams.builder()
                .model(MODEL)
                .maxTokens(4096L)
                // Structured extraction is not hard reasoning; low effort keeps it quick and cheap.
                .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                .addUserMessage(prompt)
                .build()
            val message = client().messages().create(params)
            val text = message.content()
                .mapNotNull { block -> block.text().orElse(null)?.text() }
                .joinToString("")
            // A refusal or an empty turn falls through to the on-device rules.
            text.ifBlank { null }
        } catch (e: Exception) {
            Log.w(TAG, "Claude planner unavailable, falling back to rules: ${e.message}")
            null
        }
    }

    private fun client(): AnthropicClient {
        cached?.let { if (cachedKey == apiKey) return it }
        val built = AnthropicOkHttpClient.builder().apiKey(apiKey).build()
        cached = built
        cachedKey = apiKey
        return built
    }

    private fun JSONObject.optStringOrNull(key: String): String? {
        if (!has(key) || isNull(key)) return null
        return optString(key).takeIf { it.isNotBlank() }
    }

    private fun JSONObject.optIntOrNull(key: String): Int? {
        if (!has(key) || isNull(key)) return null
        val value = opt(key)
        return when (value) {
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
            else -> null
        }
    }

    private fun normalizeTime(raw: String): String? {
        val m = Regex("^(\\d{1,2}):(\\d{2})").find(raw.trim()) ?: return null
        val h = m.groupValues[1].toIntOrNull() ?: return null
        val min = m.groupValues[2].toIntOrNull() ?: return null
        if (h !in 0..23 || min !in 0..59) return null
        return "${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}"
    }

    /** Models sometimes wrap JSON in prose or a fence. Take the outermost structure. */
    private fun extractArray(text: String): JSONArray? {
        val start = text.indexOf('[')
        val end = text.lastIndexOf(']')
        if (start < 0 || end <= start) return null
        return runCatching { JSONArray(text.substring(start, end + 1)) }.getOrNull()
    }

    private fun extractObject(text: String): JSONObject? {
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        if (start < 0 || end <= start) return null
        return runCatching { JSONObject(text.substring(start, end + 1)) }.getOrNull()
    }

    companion object {
        private const val TAG = "ClaudePlanner"
        private const val MODEL = "claude-opus-5"
        private val ISO_DAY_PATTERN = Regex("\\d{4}-\\d{2}-\\d{2}")

        @Volatile
        private var cached: AnthropicClient? = null

        @Volatile
        private var cachedKey: String? = null
    }
}
