package com.groundcontrol.planner.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [Task::class], version = 1, exportSchema = false)
abstract class PlannerDatabase : RoomDatabase() {

    abstract fun tasks(): TaskDao

    companion object {
        @Volatile
        private var instance: PlannerDatabase? = null

        fun get(context: Context): PlannerDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    PlannerDatabase::class.java,
                    "groundcontrol.db",
                ).fallbackToDestructiveMigration().build().also { instance = it }
            }
    }
}
