package com.groundcontrol.planner.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * One flight strip. Mirrors the field-for-field shape the web version uses, so a board
 * exported from there drops straight in.
 */
@Entity(tableName = "tasks")
data class Task(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val text: String,
    /** ISO yyyy-MM-dd, or null for Parked. */
    val day: String? = null,
    /** HH:mm 24-hour, or null for "sometime that day". */
    val time: String? = null,
    val durationMinutes: Int? = null,
    val category: String = Categories.OTHER,
    val priority: String = Priorities.MEDIUM,
    /** Minutes before [time] to ring. 0 means on the dot. Null means no alarm. */
    val remindMinutesBefore: Int? = null,
    val firstStep: String? = null,
    val done: Boolean = false,
    val doneAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis(),
    /** False until the planner has had a pass at category and first step. */
    val enriched: Boolean = false,
)

object Categories {
    const val WORK = "work"
    const val PERSONAL = "personal"
    const val HEALTH = "health"
    const val ERRANDS = "errands"
    const val SOCIAL = "social"
    const val OTHER = "other"
    val all = listOf(WORK, PERSONAL, HEALTH, ERRANDS, SOCIAL, OTHER)
    fun label(slug: String) = slug.replaceFirstChar { it.uppercase() }
    fun valid(slug: String?) = if (slug != null && slug in all) slug else OTHER
}

object Priorities {
    const val HIGH = "high"
    const val MEDIUM = "medium"
    const val LOW = "low"
    val all = listOf(HIGH, MEDIUM, LOW)
    fun label(slug: String) = when (slug) {
        HIGH -> "Urgent"
        LOW -> "Whenever"
        else -> "Normal"
    }
    fun rank(slug: String) = when (slug) {
        HIGH -> 0
        LOW -> 2
        else -> 1
    }
    fun valid(slug: String?) = if (slug != null && slug in all) slug else MEDIUM
}

val ISO_DAY: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
val ISO_TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")

fun Task.localDate(): LocalDate? = day?.let { runCatching { LocalDate.parse(it, ISO_DAY) }.getOrNull() }

fun Task.localTime(): LocalTime? = time?.let { runCatching { LocalTime.parse(it, ISO_TIME) }.getOrNull() }

/** When the task itself starts, if it has a moment at all. */
fun Task.startAt(): LocalDateTime? {
    val d = localDate() ?: return null
    val t = localTime() ?: return null
    return LocalDateTime.of(d, t)
}

/** When the alarm should ring, or null if this strip has no alarm. */
fun Task.alarmAt(): LocalDateTime? {
    if (done) return null
    val lead = remindMinutesBefore ?: return null
    val start = startAt() ?: return null
    return start.minusMinutes(lead.toLong())
}

fun Task.isLate(today: LocalDate = LocalDate.now()): Boolean {
    val d = localDate() ?: return false
    return !done && d.isBefore(today)
}

fun Task.isParked(): Boolean = day == null

fun remindLabel(minutes: Int?): String = when {
    minutes == null -> "no alarm"
    minutes == 0 -> "on time"
    minutes < 60 -> "$minutes min before"
    minutes == 1440 -> "1 day before"
    minutes % 60 == 0 -> "${minutes / 60} h before"
    else -> "${minutes / 60}h${minutes % 60} before"
}

fun durationLabel(minutes: Int?): String = when {
    minutes == null || minutes <= 0 -> ""
    minutes < 60 -> "${minutes}m"
    minutes % 60 == 0 -> "${minutes / 60}h"
    else -> "${minutes / 60}h${(minutes % 60).toString().padStart(2, '0')}"
}

fun clockLabel(time: String?): String {
    if (time == null) return ""
    val t = runCatching { LocalTime.parse(time, ISO_TIME) }.getOrNull() ?: return time
    val h = t.hour % 12
    val suffix = if (t.hour >= 12) "pm" else "am"
    return "${if (h == 0) 12 else h}:${t.minute.toString().padStart(2, '0')}$suffix"
}
