package com.groundcontrol.planner.plan

import com.groundcontrol.planner.data.Categories
import com.groundcontrol.planner.data.ISO_DAY
import com.groundcontrol.planner.data.Priorities
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.data.clockLabel
import com.groundcontrol.planner.data.durationLabel
import com.groundcontrol.planner.data.remindLabel
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/** A task the planner pulled out of raw text, before it becomes a row. */
data class TaskDraft(
    val text: String,
    val day: String? = null,
    val time: String? = null,
    val durationMinutes: Int? = null,
    val category: String = Categories.OTHER,
    val priority: String = Priorities.MEDIUM,
    val remindMinutesBefore: Int? = null,
    val firstStep: String? = null,
)

/**
 * Wrapper that separates "leave this field alone" (null wrapper) from
 * "set this field to null" (wrapper holding null).
 */
data class Change<out T>(val value: T)

data class TaskPatch(
    val text: Change<String>? = null,
    val day: Change<String?>? = null,
    val time: Change<String?>? = null,
    val durationMinutes: Change<Int?>? = null,
    val remindMinutesBefore: Change<Int?>? = null,
    val category: Change<String>? = null,
    val priority: Change<String>? = null,
    val firstStep: Change<String?>? = null,
) {
    val isEmpty: Boolean
        get() = text == null && day == null && time == null && durationMinutes == null &&
            remindMinutesBefore == null && category == null && priority == null && firstStep == null

    fun applyTo(task: Task): Task {
        var next = task
        text?.let { next = next.copy(text = it.value) }
        day?.let { next = next.copy(day = it.value) }
        time?.let { next = next.copy(time = it.value) }
        durationMinutes?.let { next = next.copy(durationMinutes = it.value) }
        remindMinutesBefore?.let { next = next.copy(remindMinutesBefore = it.value) }
        category?.let { next = next.copy(category = it.value) }
        priority?.let { next = next.copy(priority = it.value) }
        firstStep?.let { next = next.copy(firstStep = it.value) }
        // A strip with no day cannot hold a time or an alarm.
        if (next.day == null) next = next.copy(time = null, remindMinutesBefore = null)
        if (next.time == null) next = next.copy(remindMinutesBefore = null)
        return next
    }

    /** Plain-language summary shown before the change is committed. */
    fun describe(): String {
        val bits = mutableListOf<String>()
        text?.let { bits += "reworded" }
        day?.let {
            bits += it.value?.let { d ->
                runCatching {
                    LocalDate.parse(d, ISO_DAY).format(DateTimeFormatter.ofPattern("EEE d MMM"))
                }.getOrDefault(d)
            } ?: "no date, goes to Parked"
        }
        time?.let { bits += it.value?.let { t -> clockLabel(t) } ?: "time cleared" }
        durationMinutes?.let { bits += it.value?.let { d -> durationLabel(d) } ?: "no estimate" }
        remindMinutesBefore?.let { bits += "alarm " + remindLabel(it.value) }
        category?.let { bits += Categories.label(it.value).lowercase() }
        priority?.let { bits += Priorities.label(it.value).lowercase() + " priority" }
        firstStep?.let { bits += if (it.value == null) "first step cleared" else "new first step" }
        return bits.joinToString(" · ")
    }
}

/**
 * Everything the app needs from a "make sense of this text" engine.
 *
 * [RulesPlanner] implements all of it offline and instantly. [ClaudePlanner] does a better
 * job of wording and first steps when a key is configured and the network is up. Capture
 * never waits on the network: the rules engine always answers first.
 */
interface Planner {
    val label: String

    /** Turn a brain dump into separate strips. */
    suspend fun split(dump: String, now: LocalDateTime): List<TaskDraft>

    /** Read a change request in the person's own words. Null means "couldn't read it". */
    suspend fun amend(task: Task, words: String, now: LocalDateTime): TaskPatch?

    /** Fill in category and a first step for a strip that was captured in a hurry. */
    suspend fun enrich(task: Task): TaskPatch?
}
