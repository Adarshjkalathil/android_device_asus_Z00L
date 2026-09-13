package com.groundcontrol.planner.plan

import com.groundcontrol.planner.Settings
import com.groundcontrol.planner.data.Task
import java.time.LocalDateTime

object Planners {

    fun forSettings(settings: Settings): Planner {
        val rules = RulesPlanner(settings.defaultLeadMinutes)
        if (!settings.hasApiKey) return rules
        return FallbackPlanner(ClaudePlanner(settings.apiKey), rules)
    }
}

/**
 * Tries [preferred] first and drops to [backup] the moment anything goes wrong: no key,
 * no signal, a refusal, a reply that will not parse. The person never sees a failure,
 * only a slightly plainer result.
 */
class FallbackPlanner(
    private val preferred: Planner,
    private val backup: Planner,
) : Planner {

    override val label: String get() = "${preferred.label}, falling back to ${backup.label}"

    /** True when the last call actually reached the preferred planner. */
    @Volatile
    var lastUsedPreferred: Boolean = false
        private set

    override suspend fun split(dump: String, now: LocalDateTime): List<TaskDraft> {
        val fromPreferred = runCatching { preferred.split(dump, now) }.getOrNull()
        if (!fromPreferred.isNullOrEmpty()) {
            lastUsedPreferred = true
            return fromPreferred
        }
        lastUsedPreferred = false
        return backup.split(dump, now)
    }

    override suspend fun amend(task: Task, words: String, now: LocalDateTime): TaskPatch? {
        runCatching { preferred.amend(task, words, now) }.getOrNull()?.let {
            lastUsedPreferred = true
            return it
        }
        lastUsedPreferred = false
        return backup.amend(task, words, now)
    }

    override suspend fun enrich(task: Task): TaskPatch? {
        runCatching { preferred.enrich(task) }.getOrNull()?.let {
            lastUsedPreferred = true
            return it
        }
        lastUsedPreferred = false
        return backup.enrich(task)
    }
}
