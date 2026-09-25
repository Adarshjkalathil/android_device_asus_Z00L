package app.sayitonce;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Coach feedback for the Android app, exposed to the page as window.AndroidCoach.
 * The page builds the prompt (the same one it sends inside Claude); CoachApi sends it with
 * the user's own API key and the reply goes back to window.__sioCoach.
 * The key is kept in private app storage and excluded from backups.
 */
public class CoachBridge {

    static final String PREFS = "coach";
    private static final String KEY = "api_key";

    private final MainActivity activity;
    private final SharedPreferences prefs;
    private final CoachApi api = new CoachApi(null);
    private final ExecutorService pool = Executors.newSingleThreadExecutor();
    private final Map<String, Future<?>> running = new ConcurrentHashMap<>();

    CoachBridge(MainActivity activity, WebView web) {
        this.activity = activity;
        this.prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @JavascriptInterface
    public boolean hasKey() {
        return !key().isEmpty();
    }

    @JavascriptInterface
    public boolean setKey(String value) {
        String k = value == null ? "" : value.trim();
        if (!k.startsWith("sk-ant-") || k.length() < 20) return false;
        prefs.edit().putString(KEY, k).apply();
        return true;
    }

    @JavascriptInterface
    public void clearKey() {
        prefs.edit().remove(KEY).apply();
    }

    @JavascriptInterface
    public void ask(final String id, final String prompt) {
        // The page ignores replies for requests it has already cancelled.
        Future<?> task = pool.submit(() -> {
            CoachApi.Result r = api.ask(key(), prompt);
            running.remove(id);
            activity.sendToPage("__sioCoach", id, toJson(r));
        });
        running.put(id, task);
    }

    @JavascriptInterface
    public void cancel(String id) {
        Future<?> task = running.remove(id);
        if (task != null) task.cancel(true);
    }

    void shutdown() {
        pool.shutdownNow();
    }

    private String key() {
        return prefs.getString(KEY, "");
    }

    private static String toJson(CoachApi.Result r) {
        try {
            JSONObject o = new JSONObject().put("ok", r.ok);
            if (r.ok) o.put("text", r.text);
            else o.put("code", r.code).put("message", r.message);
            return o.toString();
        } catch (JSONException e) {
            return "{\"ok\":false,\"code\":\"upstream_error\"}";
        }
    }
}
