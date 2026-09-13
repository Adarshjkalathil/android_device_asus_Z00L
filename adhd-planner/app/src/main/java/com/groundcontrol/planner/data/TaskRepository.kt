package com.groundcontrol.planner.data

import android.content.Context
import com.groundcontrol.planner.alarm.AlarmScheduler
import com.groundcontrol.planner.widget.NextUpWidget
import kotlinx.coroutines.flow.Flow

/**
 * Every write goes through here so alarms and the home-screen widget can never drift
 * out of step with the board.
 */
class TaskRepository(
    private val appContext: Context,
    private val dao: TaskDao,
) {
    val tasks: Flow<List<Task>> = dao.observeAll()

    suspend fun all(): List<Task> = dao.all()

    suspend fun byId(id: String): Task? = dao.byId(id)

    suspend fun needingEnrichment(): List<Task> = dao.needingEnrichment()

    suspend fun addAll(newTasks: List<Task>) {
        if (newTasks.isEmpty()) return
        dao.insertAll(newTasks)
        afterWrite()
    }

    suspend fun save(task: Task) {
        dao.insert(task)
        afterWrite()
    }

    suspend fun setDone(id: String, done: Boolean) {
        val task = dao.byId(id) ?: return
        dao.insert(task.copy(done = done, doneAt = if (done) System.currentTimeMillis() else null))
        afterWrite()
    }

    suspend fun move(id: String, day: String?, clearTime: Boolean = false) {
        val task = dao.byId(id) ?: return
        dao.insert(
            task.copy(
                day = day,
                time = if (day == null || clearTime) null else task.time,
                remindMinutesBefore = if (day == null || clearTime) null else task.remindMinutesBefore,
            )
        )
        afterWrite()
    }

    suspend fun delete(id: String) {
        dao.deleteById(id)
        afterWrite()
    }

    suspend fun clearDone(ids: List<String>) {
        if (ids.isEmpty()) return
        dao.deleteDone(ids)
        afterWrite()
    }

    /** Quiet write used by the enrichment worker: no alarm reshuffle needed. */
    suspend fun saveEnriched(task: Task) {
        dao.insert(task.copy(enriched = true))
        NextUpWidget.refresh(appContext)
    }

    suspend fun afterWrite() {
        AlarmScheduler(appContext).syncAll(dao.all())
        NextUpWidget.refresh(appContext)
    }
}
