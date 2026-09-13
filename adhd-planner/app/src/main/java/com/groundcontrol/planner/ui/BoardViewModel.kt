package com.groundcontrol.planner.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.groundcontrol.planner.container
import com.groundcontrol.planner.data.Categories
import com.groundcontrol.planner.data.ISO_DAY
import com.groundcontrol.planner.data.Priorities
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.data.alarmAt
import com.groundcontrol.planner.data.isLate
import com.groundcontrol.planner.data.localDate
import com.groundcontrol.planner.plan.FallbackPlanner
import com.groundcontrol.planner.plan.TaskDraft
import com.groundcontrol.planner.work.EnrichWorker
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

enum class BoardView { TODAY, WEEK, PARKED }

class BoardViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = app.container.repository
    private val settings = app.container.settings
    private val appContext = app.applicationContext

    val tasks: StateFlow<List<Task>> = repo.tasks
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    var view by mutableStateOf(BoardView.TODAY)
        private set

    var capture by mutableStateOf("")
    var status by mutableStateOf<String?>(null)
        private set
    var filing by mutableStateOf(false)
        private set

    /** The working copy shown in the amend sheet. Nothing is written until Save. */
    var editing by mutableStateOf<Task?>(null)
        private set
    var amendWords by mutableStateOf("")
    var amendStatus by mutableStateOf<String?>(null)
        private set
    var amending by mutableStateOf(false)
        private set

    var showSettings by mutableStateOf(false)

    var alarmsEnabled by mutableStateOf(settings.alarmsEnabled)
        private set
    var defaultLead by mutableStateOf(settings.defaultLeadMinutes)
        private set
    var apiKey by mutableStateOf(settings.apiKey)
        private set

    fun switchView(next: BoardView) {
        view = next
    }

    // ---- capture -------------------------------------------------------------

    fun fileIt() {
        val dump = capture.trim()
        if (dump.isEmpty() || filing) return
        filing = true
        status = "Sorting it out…"
        viewModelScope.launch {
            val planner = appContext.container.planner
            val drafts = runCatching { planner.split(dump, LocalDateTime.now()) }.getOrDefault(emptyList())
            val fresh = drafts.map { it.toTask() }
            repo.addAll(fresh)
            capture = ""
            filing = false
            val rang = fresh.count { it.remindMinutesBefore != null }
            status = when {
                fresh.isEmpty() -> "Nothing to file from that."
                rang > 0 -> "${fresh.size} filed, $rang with an alarm."
                else -> "${fresh.size} filed."
            }
            val viaCloud = (planner as? FallbackPlanner)?.lastUsedPreferred ?: false
            if (!viaCloud && settings.hasApiKey) {
                status = status + " Read on device; the network was out of reach."
            }
            if (fresh.any { !it.enriched }) EnrichWorker.runNow(appContext)
        }
    }

    private fun TaskDraft.toTask(): Task = Task(
        text = text,
        day = day,
        time = if (day != null) time else null,
        durationMinutes = durationMinutes,
        category = Categories.valid(category),
        priority = Priorities.valid(priority),
        remindMinutesBefore = if (day != null && time != null) remindMinutesBefore else null,
        firstStep = firstStep,
        enriched = firstStep != null && category != Categories.OTHER,
    )

    fun clearStatus() {
        status = null
    }

    // ---- strip actions -------------------------------------------------------

    fun toggleDone(task: Task) = viewModelScope.launch { repo.setDone(task.id, !task.done) }

    fun moveToToday(task: Task) = viewModelScope.launch {
        repo.move(task.id, LocalDate.now().format(ISO_DAY))
    }

    fun pushOneDay(task: Task) = viewModelScope.launch {
        val base = task.localDate()?.takeIf { it.isAfter(LocalDate.now()) } ?: LocalDate.now()
        repo.move(task.id, base.plusDays(1).format(ISO_DAY))
    }

    fun park(task: Task) = viewModelScope.launch { repo.move(task.id, null, clearTime = true) }

    fun delete(task: Task) = viewModelScope.launch {
        closeEditor()
        repo.delete(task.id)
    }

    fun clearDone(ids: List<String>) = viewModelScope.launch { repo.clearDone(ids) }

    // ---- amending ------------------------------------------------------------

    fun openEditor(task: Task) {
        editing = task
        amendWords = ""
        amendStatus = null
    }

    fun closeEditor() {
        editing = null
        amendWords = ""
        amendStatus = null
    }

    fun editDraft(transform: (Task) -> Task) {
        editing = editing?.let(transform)
    }

    fun saveEditor() {
        val draft = editing ?: return
        val cleaned = draft.copy(
            text = draft.text.trim().ifBlank { "Untitled strip" },
            time = if (draft.day == null) null else draft.time,
            remindMinutesBefore = if (draft.day == null || draft.time == null) null else draft.remindMinutesBefore,
        )
        editing = null
        amendWords = ""
        amendStatus = null
        viewModelScope.launch { repo.save(cleaned) }
    }

    /** Reads the change out of plain words and shows it before anything is written. */
    fun amendInWords() {
        val draft = editing ?: return
        val words = amendWords.trim()
        if (words.isEmpty() || amending) return
        amending = true
        amendStatus = "Reading that…"
        viewModelScope.launch {
            val planner = appContext.container.planner
            val patch = runCatching { planner.amend(draft, words, LocalDateTime.now()) }.getOrNull()
            amending = false
            if (patch == null) {
                amendStatus = "Couldn't read a change out of that. Try naming a day, a time, " +
                    "how long it takes, or when to ring."
                return@launch
            }
            editing = patch.applyTo(draft)
            amendWords = ""
            amendStatus = patch.describe() + " — check it, then Save."
        }
    }

    // ---- settings ------------------------------------------------------------

    fun updateAlarmsEnabled(enabled: Boolean) {
        settings.alarmsEnabled = enabled
        alarmsEnabled = enabled
        viewModelScope.launch { repo.afterWrite() }
    }

    fun updateDefaultLead(minutes: Int) {
        settings.defaultLeadMinutes = minutes
        defaultLead = minutes
    }

    fun updateApiKey(key: String) {
        settings.apiKey = key
        apiKey = key.trim()
    }

    // ---- derived board -------------------------------------------------------

    fun todayList(all: List<Task>, today: LocalDate = LocalDate.now()): List<Task> =
        order(all.filter { it.day == today.format(ISO_DAY) || it.isLate(today) })

    fun parkedList(all: List<Task>): List<Task> = order(all.filter { it.day == null })

    fun dayList(all: List<Task>, day: LocalDate): List<Task> =
        order(all.filter { it.day == day.format(ISO_DAY) })

    fun order(list: List<Task>): List<Task> = list.sortedWith(
        compareBy<Task> { it.done }
            .thenBy { if (it.isLate()) 0 else 1 }
            .thenBy { it.time ?: "99:99" }
            .thenBy { Priorities.rank(it.priority) }
    )

    fun plannedMinutes(list: List<Task>): Int = list.filter { !it.done }.sumOf { it.durationMinutes ?: 0 }

    /** The single strip the Now card should show. One thing at a time is the whole point. */
    fun nowTask(all: List<Task>): Task? {
        val open = todayList(all).filter { !it.done }
        if (open.isEmpty()) return null
        val nowTime = LocalTime.now()
        val timed = open.filter { it.time != null }.sortedBy { it.time }
        timed.firstOrNull { task ->
            val t = runCatching { LocalTime.parse(task.time.orEmpty()) }.getOrNull()
            t != null && !t.isBefore(nowTime)
        }?.let { return it }
        open.filter { it.isLate() }.let { if (it.isNotEmpty()) return it.first() }
        open.filter { it.time == null }.let { if (it.isNotEmpty()) return it.first() }
        return timed.firstOrNull() ?: open.first()
    }

    fun nextAlarm(all: List<Task>): Pair<Task, LocalDateTime>? =
        all.mapNotNull { task -> task.alarmAt()?.let { task to it } }
            .filter { it.second.isAfter(LocalDateTime.now()) }
            .minByOrNull { it.second }
}
