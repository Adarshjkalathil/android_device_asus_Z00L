package app.sayitonce;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.util.Calendar;

/** Schedules the once-a-day practice reminder. */
final class Reminders {

    static final String CHANNEL = "practice";
    private static final String PREFS = "reminder";
    // Alarms may be delayed a little to save battery; a practice nudge doesn't need to be exact.
    private static final long WINDOW_MS = 15 * 60 * 1000L;

    static final class Setting {
        boolean enabled;
        int hour;
        int minute;
    }

    private Reminders() { }

    static Setting load(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Setting s = new Setting();
        s.enabled = p.getBoolean("enabled", false);
        s.hour = p.getInt("hour", 8);
        s.minute = p.getInt("minute", 30);
        return s;
    }

    static void save(Context c, boolean enabled, int hour, int minute) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("enabled", enabled)
                .putInt("hour", Math.max(0, Math.min(23, hour)))
                .putInt("minute", Math.max(0, Math.min(59, minute)))
                .apply();
    }

    static void schedule(Context c) {
        Setting s = load(c);
        if (!s.enabled) return;
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, s.hour);
        next.set(Calendar.MINUTE, s.minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis() + 1000) next.add(Calendar.DAY_OF_YEAR, 1);
        AlarmManager am = c.getSystemService(AlarmManager.class);
        am.setWindow(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), WINDOW_MS, pending(c));
    }

    static void cancel(Context c) {
        c.getSystemService(AlarmManager.class).cancel(pending(c));
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL, c.getString(R.string.channel_name), NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription(c.getString(R.string.channel_description));
            nm.createNotificationChannel(ch);
        }
    }

    private static PendingIntent pending(Context c) {
        Intent i = new Intent(c, ReminderReceiver.class);
        return PendingIntent.getBroadcast(c, 1, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
