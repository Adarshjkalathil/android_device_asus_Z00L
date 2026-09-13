package com.groundcontrol.planner

import android.app.Application
import android.content.Context
import com.groundcontrol.planner.alarm.Notifications
import com.groundcontrol.planner.data.PlannerDatabase
import com.groundcontrol.planner.data.TaskRepository
import com.groundcontrol.planner.plan.Planner
import com.groundcontrol.planner.plan.Planners
import com.groundcontrol.planner.work.EnrichWorker

class PlannerApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        Notifications.createChannels(this)
        EnrichWorker.ensureScheduled(this)
    }
}

class AppContainer(private val context: Context) {

    val settings: Settings by lazy { Settings(context) }

    val repository: TaskRepository by lazy {
        TaskRepository(context.applicationContext, PlannerDatabase.get(context).tasks())
    }

    /** Rebuilt on each read so a freshly pasted API key takes effect immediately. */
    val planner: Planner get() = Planners.forSettings(settings)
}

val Context.container: AppContainer
    get() = (applicationContext as PlannerApp).container
