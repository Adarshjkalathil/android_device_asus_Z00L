package app.sayitonce;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

/**
 * Hosts the Say It Once page in a WebView and adds what a browser tab can't do:
 * microphone access, Android's speech recognizer, daily reminders and the coach.
 */
public class MainActivity extends Activity {

    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/assets/index.html";

    private static final int REQ_MIC = 1;
    private static final int REQ_FILE = 2;
    private static final int REQ_NOTIFY = 3;

    private WebView web;
    private SpeechBridge speech;
    private CoachBridge coach;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingWebPermission;
    private Runnable micGranted;
    private Runnable micDenied;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        boolean dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        int pageColor = dark ? Color.rgb(0x0B, 0x10, 0x19) : Color.rgb(0xEC, 0xEF, 0xF5);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(pageColor);
        web = new WebView(this);
        web.setBackgroundColor(pageColor);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        styleSystemBars(root, pageColor, dark);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost())) return false;
                // Links to other sites (the research brief, Toastmasters) open in the browser.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                boolean ours = HOST.equals(request.getOrigin().getHost());
                boolean wantsAudio = false;
                for (String r : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsAudio = true;
                }
                if (!ours || !wantsAudio) {
                    request.deny();
                    return;
                }
                withMic(
                        () -> request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}),
                        request::deny);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        speech = new SpeechBridge(this, web);
        coach = new CoachBridge(this, web);
        web.addJavascriptInterface(speech, "AndroidSpeech");
        web.addJavascriptInterface(coach, "AndroidCoach");
        web.addJavascriptInterface(new AppBridge(this), "AndroidApp");

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    /** Draws the page color behind the status and navigation bars and keeps content out from under them. */
    private void styleSystemBars(View root, int pageColor, boolean dark) {
        getWindow().setStatusBarColor(pageColor);
        getWindow().setNavigationBarColor(pageColor);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(dark ? 0 : light, light);
            }
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        } else if (!dark) {
            int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
    }

    /** Runs onGranted once the app holds the microphone permission, asking the user if needed. */
    void withMic(Runnable onGranted, Runnable onDenied) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            onGranted.run();
            return;
        }
        if (micDenied != null) micDenied.run();
        micGranted = onGranted;
        micDenied = onDenied;
        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
    }

    /** Asks for notification permission on Android 13+, where reminders need it. */
    void ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            runOnUiThread(() -> requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY));
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != REQ_MIC) return;
        boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        Runnable next = granted ? micGranted : micDenied;
        micGranted = null;
        micDenied = null;
        if (next != null) next.run();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        speech.stopQuietly();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        speech.destroy();
        coach.shutdown();
        web.destroy();
        super.onDestroy();
    }

    /** Calls a JavaScript function on the page with one JSON string argument. */
    void sendToPage(String function, String... args) {
        StringBuilder js = new StringBuilder("window.").append(function).append("&&window.")
                .append(function).append('(');
        for (int i = 0; i < args.length; i++) {
            if (i > 0) js.append(',');
            js.append(org.json.JSONObject.quote(args[i]));
        }
        js.append(')');
        runOnUiThread(() -> web.evaluateJavascript(js.toString(), null));
    }
}
