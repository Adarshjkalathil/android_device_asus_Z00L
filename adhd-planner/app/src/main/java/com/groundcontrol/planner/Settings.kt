package com.groundcontrol.planner

import android.content.Context

/** Small, boring preference store. Nothing here is worth a database. */
class Settings(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences("groundcontrol", Context.MODE_PRIVATE)

    var alarmsEnabled: Boolean
        get() = prefs.getBoolean(KEY_ALARMS, true)
        set(value) = prefs.edit().putBoolean(KEY_ALARMS, value).apply()

    /** Lead time handed to any new strip that arrives with a clock time. */
    var defaultLeadMinutes: Int
        get() = prefs.getInt(KEY_LEAD, 15)
        set(value) = prefs.edit().putInt(KEY_LEAD, value).apply()

    /**
     * Optional Anthropic API key. Empty means the app runs entirely on its own
     * rules engine, which is the default and needs no network at all.
     */
    var apiKey: String
        get() = prefs.getString(KEY_API, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_API, value.trim()).apply()

    val hasApiKey: Boolean get() = apiKey.isNotBlank()

    companion object {
        private const val KEY_ALARMS = "alarms_enabled"
        private const val KEY_LEAD = "default_lead_minutes"
        private const val KEY_API = "anthropic_api_key"
        const val DEFAULT_LEAD = 15
    }
}
