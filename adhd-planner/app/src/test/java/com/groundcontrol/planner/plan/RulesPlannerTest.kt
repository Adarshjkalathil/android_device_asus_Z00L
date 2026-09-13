package com.groundcontrol.planner.plan

import com.groundcontrol.planner.data.Categories
import com.groundcontrol.planner.data.Priorities
import com.groundcontrol.planner.data.Task
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * The date maths is the part the alarms depend on, so it is the part that gets tested.
 * Wednesday 10 September 2025, 10:00 is "now" throughout.
 */
class RulesPlannerTest {

    private val now: LocalDateTime = LocalDateTime.of(2025, 9, 10, 10, 0)
    private val planner = RulesPlanner(defaultLeadMinutes = 15)

    private fun draft(text: String): TaskDraft = planner.draft(text, now)

    @Test
    fun `tomorrow with a clock time lands on the next day`() {
        val d = draft("dentist tomorrow 9am")
        assertEquals("2025-09-11", d.day)
        assertEquals("09:00", d.time)
        assertEquals("dentist", d.text)
    }

    @Test
    fun `anything with a time gets the default alarm`() {
        assertEquals(15, draft("standup tomorrow 9:30").remindMinutesBefore)
    }

    @Test
    fun `a strip with no time gets no alarm`() {
        val d = draft("buy milk")
        assertNull(d.time)
        assertNull(d.remindMinutesBefore)
    }

    @Test
    fun `naming a weekday means the next one coming, never today`() {
        // 10 Sep 2025 is a Wednesday.
        assertEquals("2025-09-12", draft("send report friday").day)
        assertEquals("2025-09-17", draft("team sync wednesday").day)
    }

    @Test
    fun `relative spans resolve to real dates`() {
        assertEquals("2025-09-13", draft("chase invoice in 3 days").day)
        assertEquals("2025-09-17", draft("review next week").day)
        assertEquals("2025-09-12", draft("call plumber day after tomorrow").day)
    }

    @Test
    fun `a bare clock time later today stays today`() {
        assertEquals("2025-09-10", draft("call bank at 2pm").day)
        assertEquals("14:00", draft("call bank at 2pm").time)
    }

    @Test
    fun `a bare clock time already past rolls to tomorrow`() {
        assertEquals("2025-09-11", draft("call bank at 8am").day)
    }

    @Test
    fun `a reminder lead is never mistaken for a duration`() {
        val d = draft("call bank at 2pm remind me 30 minutes before")
        assertEquals(30, d.remindMinutesBefore)
        assertEquals("14:00", d.time)
        // 30 was the alarm, so the estimate must not have been read from it.
        assertTrue("duration was $d", d.durationMinutes != 30 || d.text.contains("bank"))
        assertEquals("call bank", d.text)
    }

    @Test
    fun `hours and minutes combine into one estimate`() {
        assertEquals(90, draft("write report 1 hour 30 minutes").durationMinutes)
        assertEquals(45, draft("gym 45 min").durationMinutes)
        assertEquals(30, draft("tidy desk half an hour").durationMinutes)
    }

    @Test
    fun `urgency and category are read from the words`() {
        val d = draft("send the client report friday urgent")
        assertEquals(Priorities.HIGH, d.priority)
        assertEquals(Categories.WORK, d.category)
    }

    @Test
    fun `every strip carries an estimate so the load meter means something`() {
        assertNotNull(draft("something vague").durationMinutes)
    }

    @Test
    fun `a first step is offered without any model`() {
        assertNotNull(draft("email the landlord").firstStep)
    }

    @Test
    fun `a brain dump splits on commas`() = runBlocking {
        val items = planner.split("dentist tomorrow 9am, groceries, report due friday urgent", now)
        assertEquals(3, items.size)
        assertEquals("2025-09-11", items[0].day)
        assertNull(items[1].day)
        assertEquals("2025-09-12", items[2].day)
    }

    @Test
    fun `a brain dump splits on lines first`() = runBlocking {
        val items = planner.split("dentist tomorrow 9am\n- groceries, milk and bread", now)
        assertEquals(2, items.size)
        assertEquals("groceries, milk and bread", items[1].text)
    }

    // ---- amending ----

    private val parked = Task(
        id = "t1",
        text = "Send the revised quote",
        day = null,
        time = null,
        durationMinutes = 25,
        category = Categories.WORK,
        priority = Priorities.MEDIUM,
        remindMinutesBefore = null,
    )

    @Test
    fun `plain words move a strip and set its alarm`() = runBlocking {
        val patch = planner.amend(parked, "push to friday 3pm, 90 minutes, remind me an hour before", now)
        assertNotNull(patch)
        val next = patch!!.applyTo(parked)
        assertEquals("2025-09-12", next.day)
        assertEquals("15:00", next.time)
        assertEquals(90, next.durationMinutes)
        assertEquals(60, next.remindMinutesBefore)
    }

    @Test
    fun `plain words can switch the alarm off`() = runBlocking {
        val dated = parked.copy(day = "2025-09-12", time = "15:00", remindMinutesBefore = 30)
        val patch = planner.amend(dated, "no alarm please", now)
        assertNotNull(patch)
        assertNull(patch!!.applyTo(dated).remindMinutesBefore)
    }

    @Test
    fun `parking a strip strips its time and alarm`() = runBlocking {
        val dated = parked.copy(day = "2025-09-12", time = "15:00", remindMinutesBefore = 30)
        val patch = planner.amend(dated, "park it, no date", now)
        assertNotNull(patch)
        val next = patch!!.applyTo(dated)
        assertNull(next.day)
        assertNull(next.time)
        assertNull(next.remindMinutesBefore)
    }

    @Test
    fun `push with no day named moves it one day on`() = runBlocking {
        val dated = parked.copy(day = "2025-09-15")
        val patch = planner.amend(dated, "push it", now)
        assertEquals("2025-09-16", patch!!.applyTo(dated).day)
    }

    @Test
    fun `nonsense returns nothing rather than guessing`() = runBlocking {
        assertNull(planner.amend(parked, "asdf qwerty", now))
    }

    @Test
    fun `enrichment fills a blank first step without touching the rest`() = runBlocking {
        val bare = parked.copy(category = Categories.OTHER, firstStep = null, text = "email the landlord")
        val patch = planner.enrich(bare)
        assertNotNull(patch)
        assertNotNull(patch!!.applyTo(bare).firstStep)
    }

    @Test
    fun `today is today`() {
        val d = planner.draft("call mum today", LocalDateTime.of(LocalDate.of(2025, 12, 31), now.toLocalTime()))
        assertEquals("2025-12-31", d.day)
    }
}
