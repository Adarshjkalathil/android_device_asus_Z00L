package app.sayitonce;

import android.webkit.JavascriptInterface;

import org.json.JSONException;
import org.json.JSONObject;

/** App-level settings for the page, exposed as window.AndroidApp. */
public class AppBridge {

    private final MainActivity activity;

    AppBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String getReminder() {
        Reminders.Setting s = Reminders.load(activity);
        try {
            return new JSONObject()
                    .put("enabled", s.enabled)
                    .put("hour", s.hour)
                    .put("minute", s.minute)
                    .toString();
        } catch (JSONException e) {
            return "{}";
        }
    }

    @JavascriptInterface
    public boolean setReminder(boolean enabled, int hour, int minute) {
        Reminders.save(activity, enabled, hour, minute);
        if (enabled) {
            activity.ensureNotificationPermission();
            Reminders.schedule(activity);
        } else {
            Reminders.cancel(activity);
        }
        return true;
    }
}
