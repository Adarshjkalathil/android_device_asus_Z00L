package app.sayitonce;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.util.Calendar;

/** Shows the daily practice notification, then schedules tomorrow's. */
public class ReminderReceiver extends BroadcastReceiver {

    private static final String[] LINES = {
            "Think loud. Five minutes keeps your streak going.",
            "One phone test and one answer. Point first.",
            "Warm up your voice before today's first conversation.",
            "Try one Table Topic today: 10 seconds to think, 1 minute to talk.",
            "Land the last word. A quick drill takes five minutes."
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Reminders.load(context).enabled) {
            Reminders.ensureChannel(context);
            Intent open = new Intent(context, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent tap = PendingIntent.getActivity(context, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            String line = LINES[Calendar.getInstance().get(Calendar.DAY_OF_YEAR) % LINES.length];
            Notification n = new Notification.Builder(context, Reminders.CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat_notify)
                    .setContentTitle(context.getString(R.string.reminder_title))
                    .setContentText(line)
                    .setContentIntent(tap)
                    .setAutoCancel(true)
                    .build();
            context.getSystemService(NotificationManager.class).notify(1, n);
        }
        Reminders.schedule(context);
    }
}
