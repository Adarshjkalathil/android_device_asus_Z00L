package com.groundcontrol.planner.plan

import com.groundcontrol.planner.data.Categories
import com.groundcontrol.planner.data.ISO_DAY
import com.groundcontrol.planner.data.ISO_TIME
import com.groundcontrol.planner.data.Priorities
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.data.localDate
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

/**
 * The deterministic half of the app, and the half that matters most.
 *
 * Dates, clock times, durations and urgency are arithmetic, not language: twenty lines of
 * date maths beat any small model at "next Friday", and they run instantly with the radio
 * off. Capture is never allowed to wait on a network round trip, so this always answers.
 */
class RulesPlanner(private val defaultLeadMinutes: Int = 15) : Planner {

    override val label: String = "on-device rules"

    override suspend fun split(dump: String, now: LocalDateTime): List<TaskDraft> {
        val lines = dump.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        val items = if (lines.size >= 2) lines
        else dump.split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
        return items.map { raw -> draft(raw.trimStart('-', '*', '•', ' '), now) }
    }

    fun draft(raw: String, now: LocalDateTime): TaskDraft {
        val scan = Scan(raw)
        val remind = scan.takeRemind(defaultLeadMinutes)
        val duration = scan.takeDuration()
        var day = scan.takeDay(now.toLocalDate())
        val time = scan.takeTime()
        val priority = scan.takePriority()

        // A bare clock time means the next time that clock comes round.
        if (day == null && time != null) {
            val parsed = runCatching { LocalTime.parse(time, ISO_TIME) }.getOrNull()
            day = if (parsed != null && parsed.isAfter(now.toLocalTime())) {
                now.toLocalDate().format(ISO_DAY)
            } else {
                now.toLocalDate().plusDays(1).format(ISO_DAY)
            }
        }

        val text = scan.cleaned().ifBlank { raw.trim() }
        val category = Categorizer.of(raw)
        val effectiveTime = if (day == null) null else time
        val effectiveRemind = when {
            effectiveTime == null -> null
            remind != null -> remind.value
            else -> defaultLeadMinutes
        }
        return TaskDraft(
            text = text.take(240),
            day = day,
            time = effectiveTime,
            durationMinutes = duration ?: Estimates.of(raw),
            category = category,
            priority = priority ?: Priorities.MEDIUM,
            remindMinutesBefore = effectiveRemind,
            firstStep = FirstSteps.suggest(text),
        )
    }

    override suspend fun amend(task: Task, words: String, now: LocalDateTime): TaskPatch? {
        val scan = Scan(words)
        var patch = TaskPatch()

        scan.takeRename()?.let { patch = patch.copy(text = Change(it.take(240))) }

        if (scan.matchesPark()) {
            patch = patch.copy(day = Change(null), time = Change(null), remindMinutesBefore = Change(null))
        }

        scan.takeRemind(defaultLeadMinutes)?.let { patch = patch.copy(remindMinutesBefore = Change(it.value)) }
        scan.takeDuration()?.let { patch = patch.copy(durationMinutes = Change(it)) }

        val day = scan.takeDay(now.toLocalDate())
        if (day != null) {
            patch = patch.copy(day = Change(day))
        } else if (patch.day == null && scan.matchesPush()) {
            val base = task.localDate()?.takeIf { it.isAfter(now.toLocalDate()) } ?: now.toLocalDate()
            patch = patch.copy(day = Change(base.plusDays(1).format(ISO_DAY)))
        }

        if (scan.matchesClearTime()) {
            patch = patch.copy(time = Change(null))
        } else {
            scan.takeTime()?.let { patch = patch.copy(time = Change(it)) }
        }

        scan.takePriority()?.let { patch = patch.copy(priority = Change(it)) }
        Categorizer.explicit(words)?.let { patch = patch.copy(category = Change(it)) }

        // Moving a strip onto a day it did not have gives it the default alarm.
        val gainsTime = patch.time?.value != null && task.time == null
        if (gainsTime && patch.remindMinutesBefore == null && task.remindMinutesBefore == null) {
            patch = patch.copy(remindMinutesBefore = Change(defaultLeadMinutes))
        }

        return if (patch.isEmpty) null else patch
    }

    override suspend fun enrich(task: Task): TaskPatch? {
        var patch = TaskPatch()
        if (task.category == Categories.OTHER) {
            val guess = Categorizer.of(task.text)
            if (guess != Categories.OTHER) patch = patch.copy(category = Change(guess))
        }
        if (task.firstStep.isNullOrBlank()) {
            FirstSteps.suggest(task.text)?.let { patch = patch.copy(firstStep = Change(it)) }
        }
        if (task.durationMinutes == null) {
            patch = patch.copy(durationMinutes = Change(Estimates.of(task.text)))
        }
        return if (patch.isEmpty) null else patch
    }
}

/** Matched fragments are removed as they are read, so "30 min before" is never also a duration. */
private class Scan(text: String) {

    var work: String = text

    private fun take(regex: Regex): MatchResult? {
        val m = regex.find(work) ?: return null
        work = work.substring(0, m.range.first) + " " + work.substring(m.range.last + 1)
        return m
    }

    private fun has(regex: Regex) = regex.containsMatchIn(work)

    fun matchesPark() = has(PARK)

    fun matchesPush() = has(PUSH)

    fun matchesClearTime() = has(CLEAR_TIME)

    fun takeRename(): String? = RENAME.find(work)?.groupValues?.get(1)?.trim()?.trim('"', '\'')

    fun takeRemind(default: Int): Change<Int?>? {
        if (has(NO_ALARM)) {
            take(NO_ALARM)
            take(REMIND_ANY)
            return Change(null)
        }
        if (take(REMIND_HALF_HOUR) != null) {
            take(REMIND_ANY)
            return Change(30)
        }
        take(REMIND_EXPLICIT)?.let { m ->
            val count = m.groupValues[1].toIntOrNull() ?: return@let
            take(REMIND_ANY)
            return Change(scaleLead(count, m.groupValues[2]))
        }
        take(REMIND_WORDED)?.let { m ->
            take(REMIND_ANY)
            return Change(scaleLead(1, m.groupValues[2]))
        }
        if (has(REMIND_ON_TIME)) {
            take(REMIND_ON_TIME)
            take(REMIND_ANY)
            return Change(0)
        }
        if (has(REMIND_ANY)) {
            take(REMIND_ANY)
            return Change(default)
        }
        return null
    }

    private fun scaleLead(count: Int, unitWord: String): Int {
        val unit = unitWord.lowercase().first()
        return when (unit) {
            'h' -> count * 60
            'd' -> count * 1440
            else -> count
        }.coerceIn(0, 10080)
    }

    fun takeDuration(): Int? {
        if (has(HALF_HOUR)) {
            take(HALF_HOUR)
            return 30
        }
        val hours = take(DURATION_HOURS)?.groupValues?.get(1)?.toDoubleOrNull()
        val mins = take(DURATION_MINUTES)?.groupValues?.get(1)?.toIntOrNull()
        val total = (hours?.times(60))?.toInt()?.plus(mins ?: 0) ?: mins
        return total?.coerceIn(5, 480)
    }

    fun takeDay(today: LocalDate): String? {
        take(DAY_AFTER_TOMORROW)?.let { return today.plusDays(2).format(ISO_DAY) }
        take(TOMORROW)?.let { return today.plusDays(1).format(ISO_DAY) }
        take(TODAY)?.let { return today.format(ISO_DAY) }
        take(IN_DAYS)?.let { m ->
            m.groupValues[1].toLongOrNull()?.let { return today.plusDays(it).format(ISO_DAY) }
        }
        take(IN_WEEKS)?.let { m ->
            m.groupValues[1].toLongOrNull()?.let { return today.plusWeeks(it).format(ISO_DAY) }
        }
        take(ISO_DATE)?.let { m ->
            runCatching { LocalDate.parse(m.value, ISO_DAY) }.getOrNull()?.let { return it.format(ISO_DAY) }
        }
        take(DAY_MONTH)?.let { m ->
            monthDay(today, m.groupValues[1].toIntOrNull(), m.groupValues[3])?.let { return it }
        }
        take(MONTH_DAY)?.let { m ->
            monthDay(today, m.groupValues[2].toIntOrNull(), m.groupValues[1])?.let { return it }
        }
        take(WEEKDAY)?.let { m ->
            val target = WEEKDAY_NAMES[m.groupValues[2].lowercase().take(3)] ?: return@let
            return nextWeekday(today, target).format(ISO_DAY)
        }
        take(NEXT_WEEK)?.let { return today.plusWeeks(1).format(ISO_DAY) }
        return null
    }

    private fun monthDay(today: LocalDate, dayOfMonth: Int?, monthToken: String): String? {
        val month = MONTH_NAMES[monthToken.lowercase().take(3)] ?: return null
        val d = dayOfMonth ?: return null
        if (d !in 1..31) return null
        var candidate = runCatching { LocalDate.of(today.year, month, d) }.getOrNull() ?: return null
        if (candidate.isBefore(today)) candidate = candidate.plusYears(1)
        return candidate.format(ISO_DAY)
    }

    fun takeTime(): String? {
        take(TIME_MERIDIEM)?.let { m ->
            val raw = m.groupValues[1].toIntOrNull() ?: return@let
            val minutes = m.groupValues[3].toIntOrNull() ?: 0
            val pm = m.groupValues[4].lowercase().startsWith("p")
            var hour = raw % 12
            if (pm) hour += 12
            if (hour in 0..23 && minutes in 0..59) {
                return LocalTime.of(hour, minutes).format(ISO_TIME)
            }
        }
        take(TIME_24H)?.let { m ->
            val hour = m.groupValues[1].toIntOrNull() ?: return@let
            val minutes = m.groupValues[2].toIntOrNull() ?: return@let
            if (hour in 0..23 && minutes in 0..59) {
                return LocalTime.of(hour, minutes).format(ISO_TIME)
            }
        }
        take(NOON)?.let { return "12:00" }
        take(MIDNIGHT)?.let { return "00:00" }
        return null
    }

    fun takePriority(): String? {
        take(PRIORITY_HIGH)?.let { return Priorities.HIGH }
        take(PRIORITY_LOW)?.let { return Priorities.LOW }
        take(PRIORITY_MEDIUM)?.let { return Priorities.MEDIUM }
        return null
    }

    fun cleaned(): String = work
        .replace(LEFTOVER_LEAD, " ")
        .replace(Regex("\\s+"), " ")
        .replace(LEADING_FILLER, "")
        .replace(TRAILING_FILLER, "")
        .trim()
        .trim('-', ',', ':', ';', '.', ' ')
        .trim()

    companion object {
        private fun ci(pattern: String) = Regex(pattern, RegexOption.IGNORE_CASE)

        val PARK = ci("\\b(park|parked|unschedule|someday|no date|sometime|backlog)\\b")
        val PUSH = ci("\\b(push|postpone|bump|later|move it back)\\b")
        val CLEAR_TIME = ci("\\b(no time|any time|anytime|clear the time|clear time)\\b")
        val RENAME = ci("(?:rename (?:it )?to|call it|change (?:the )?(?:text|title|name) to)\\s+(.+)$")

        val NO_ALARM = ci("\\b(no alarm|no reminder|don'?t remind me|do not remind me|without a reminder|mute it)\\b")
        val REMIND_EXPLICIT =
            ci("(\\d{1,4})\\s*(minutes|minute|mins|min|hours|hour|hrs|hr|days|day|m|h|d)\\s+(?:before|ahead|early|in advance)")
        val REMIND_WORDED =
            ci("\\b(an?|one)\\s+(hours?|hrs?|days?|minutes?|mins?)\\s+(?:before|ahead|early|in advance)\\b")
        val REMIND_HALF_HOUR = ci("\\bhalf an hour\\s+(?:before|ahead|early|in advance)\\b")
        val REMIND_ON_TIME = ci("\\b(on time|at the time|when it starts)\\b")
        val REMIND_ANY = ci("\\b(remind me|reminder|alarm|alert me|ring me|ping me|wake me)\\b")

        val HALF_HOUR = ci("\\bhalf an hour\\b")
        val DURATION_HOURS = ci("(\\d{1,2}(?:\\.\\d+)?)\\s*(?:hours|hour|hrs|hr|h)\\b")
        val DURATION_MINUTES = ci("(\\d{1,3})\\s*(?:minutes|minute|mins|min|m)\\b")

        val TODAY = ci("\\b(today|tonight|this evening|this afternoon)\\b")
        val TOMORROW = ci("\\b(tomorrow|tmrw|tmr)\\b")
        val DAY_AFTER_TOMORROW = ci("\\bday after tomorrow\\b")
        val IN_DAYS = ci("\\bin (\\d{1,3}) days?\\b")
        val IN_WEEKS = ci("\\bin (\\d{1,2}) weeks?\\b")
        val NEXT_WEEK = ci("\\bnext week\\b")
        val ISO_DATE = ci("\\b\\d{4}-\\d{2}-\\d{2}\\b")
        val DAY_MONTH = ci("\\b(\\d{1,2})(st|nd|rd|th)?\\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\b")
        val MONTH_DAY = ci("\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b")
        val WEEKDAY = ci("\\b(next\\s+|this\\s+)?(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*day?\\b")

        val TIME_MERIDIEM = ci("\\b(\\d{1,2})([:.](\\d{2}))?\\s*(am|pm)\\b")
        val TIME_24H = ci("\\b(\\d{1,2}):(\\d{2})\\b")
        val NOON = ci("\\b(noon|midday)\\b")
        val MIDNIGHT = ci("\\bmidnight\\b")

        val PRIORITY_HIGH = ci("\\b(urgent|asap|critical|top priority|high priority)\\b")
        val PRIORITY_LOW = ci("\\b(low priority|no rush|whenever|optional|nice to have)\\b")
        val PRIORITY_MEDIUM = ci("\\b(normal priority|medium priority|not urgent)\\b")

        val LEFTOVER_LEAD = ci("\\s+(?:before|ahead|early|in advance)\\b")
        val LEADING_FILLER =
            ci("^(?:at|on|by|due|to|remind me to|remember to|i need to|need to|have to|must|should)\\s+")
        val TRAILING_FILLER = ci("\\s+(?:at|on|by|due|for|in)\\s*$")

        val WEEKDAY_NAMES = mapOf(
            "mon" to DayOfWeek.MONDAY,
            "tue" to DayOfWeek.TUESDAY,
            "wed" to DayOfWeek.WEDNESDAY,
            "thu" to DayOfWeek.THURSDAY,
            "fri" to DayOfWeek.FRIDAY,
            "sat" to DayOfWeek.SATURDAY,
            "sun" to DayOfWeek.SUNDAY,
        )

        val MONTH_NAMES = mapOf(
            "jan" to 1, "feb" to 2, "mar" to 3, "apr" to 4, "may" to 5, "jun" to 6,
            "jul" to 7, "aug" to 8, "sep" to 9, "oct" to 10, "nov" to 11, "dec" to 12,
        )

        /** Naming a weekday always means the next one coming, never today. */
        fun nextWeekday(today: LocalDate, target: DayOfWeek): LocalDate {
            var delta = (target.value - today.dayOfWeek.value + 7) % 7
            if (delta == 0) delta = 7
            return today.plusDays(delta.toLong())
        }
    }
}

private object Categorizer {

    private val table: List<Pair<String, Regex>> = listOf(
        Categories.HEALTH to Regex(
            "(?i)\\b(doctor|dentist|gp|clinic|hospital|prescription|pharmacy|medicine|meds|therapy|therapist|gym|run|jog|workout|exercise|yoga|swim|dose|vaccine|blood test)\\b"
        ),
        Categories.WORK to Regex(
            "(?i)\\b(work|meeting|standup|client|boss|report|deck|slides|invoice|deploy|sprint|ticket|pr|pull request|deadline|presentation|interview|timesheet|contract)\\b"
        ),
        Categories.ERRANDS to Regex(
            "(?i)\\b(groceries|grocery|shopping|supermarket|post office|parcel|package|laundry|dry clean|bins?|rubbish|trash|petrol|fuel|car wash|pick up|drop off|hardware|chemist)\\b"
        ),
        Categories.SOCIAL to Regex(
            "(?i)\\b(birthday|dinner|lunch|drinks|coffee with|party|wedding|friend|mum|mom|dad|sister|brother|catch up|visit|date night)\\b"
        ),
        Categories.PERSONAL to Regex(
            "(?i)\\b(bank|tax|taxes|insurance|rent|mortgage|passport|visa|licence|license|renew|admin|budget|savings|will|personal)\\b"
        ),
    )

    /** Best guess for any text. */
    fun of(text: String): String =
        table.firstOrNull { it.second.containsMatchIn(text) }?.first ?: Categories.OTHER

    /** Only when the person named the bucket outright, used when amending. */
    fun explicit(text: String): String? {
        val named = Regex("(?i)\\b(work|personal|health|errands?|social)\\b").find(text) ?: return null
        val word = named.groupValues[1].lowercase()
        return Categories.all.firstOrNull { it.startsWith(word.take(4)) }
    }
}

private object Estimates {

    private val table: List<Pair<Regex, Int>> = listOf(
        Regex("(?i)\\b(meeting|interview|appointment|standup|class|lesson)\\b") to 60,
        Regex("(?i)\\b(e-?mail|reply|text|message|book|pay|renew|confirm|rsvp)\\b") to 15,
        Regex("(?i)\\b(groceries|shopping|errand|post office|pharmacy|bank)\\b") to 45,
        Regex("(?i)\\b(report|write|draft|study|research|code|refactor|essay|revise|plan)\\b") to 90,
        Regex("(?i)\\b(clean|tidy|laundry|dishes|hoover|vacuum)\\b") to 30,
        Regex("(?i)\\b(gym|run|workout|swim|yoga|walk)\\b") to 60,
    )

    /** Every strip gets an honest guess, otherwise the day's load meter means nothing. */
    fun of(text: String): Int = table.firstOrNull { it.first.containsMatchIn(text) }?.second ?: 30
}
