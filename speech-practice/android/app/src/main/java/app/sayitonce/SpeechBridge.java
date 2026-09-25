package app.sayitonce;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;

/**
 * Exposes Android's speech recognizer to the page as window.AndroidSpeech, because WebView
 * has no Web Speech API. Listening continues across pauses until the page calls stop().
 * Events go to window.__sioSpeech as JSON: speechstart, partial, final, error and end.
 */
public class SpeechBridge {

    private final MainActivity activity;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private boolean wanted;
    private boolean active;
    private String language = "en-US";

    SpeechBridge(MainActivity activity, WebView web) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean available() {
        return SpeechRecognizer.isRecognitionAvailable(activity);
    }

    @JavascriptInterface
    public void start(final String lang) {
        ui.post(() -> {
            language = (lang == null || lang.isEmpty()) ? "en-US" : lang;
            activity.withMic(this::begin, () -> {
                emit("error", "message", "Allow microphone access in Android settings to use listening.");
                emit("end", null, null);
            });
        });
    }

    @JavascriptInterface
    public void stop() {
        ui.post(() -> {
            wanted = false;
            if (recognizer != null && active) {
                recognizer.stopListening(); // final results arrive, then "end" is sent
            } else {
                emit("end", null, null);
            }
        });
    }

    /** Stops without waiting for results, e.g. when the app goes to the background. */
    void stopQuietly() {
        ui.post(() -> {
            if (!wanted && !active) return;
            wanted = false;
            active = false;
            if (recognizer != null) recognizer.cancel();
            emit("end", null, null);
        });
    }

    void destroy() {
        ui.post(() -> {
            if (recognizer != null) recognizer.destroy();
            recognizer = null;
        });
    }

    private void begin() {
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(activity);
            recognizer.setRecognitionListener(listener);
        } else if (active) {
            recognizer.cancel(); // a new start replaces the current session without an "end"
        }
        wanted = true;
        listen();
    }

    private void listen() {
        if (!wanted || recognizer == null) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L);
        active = true;
        recognizer.startListening(intent);
    }

    private void sessionOver() {
        active = false;
        if (wanted) {
            ui.postDelayed(this::listen, 150);
        } else {
            emit("end", null, null);
        }
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) { }
        @Override public void onBeginningOfSpeech() { emit("speechstart", null, null); }
        @Override public void onRmsChanged(float rmsdB) { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int eventType, Bundle params) { }

        @Override
        public void onPartialResults(Bundle partial) {
            String text = first(partial);
            if (text != null && !text.isEmpty()) emit("partial", "text", text);
        }

        @Override
        public void onResults(Bundle results) {
            String text = first(results);
            if (text != null && !text.isEmpty()) emit("final", "text", text);
            sessionOver();
        }

        @Override
        public void onError(int error) {
            switch (error) {
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                case SpeechRecognizer.ERROR_CLIENT:
                    sessionOver(); // silence or a restart: keep listening if still wanted
                    break;
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                    active = false;
                    if (wanted) ui.postDelayed(SpeechBridge.this::listen, 400);
                    else emit("end", null, null);
                    break;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    fail("Allow microphone access in Android settings to use listening.");
                    break;
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                case SpeechRecognizer.ERROR_SERVER:
                    fail("Speech recognition needs an internet connection on this phone. Use your keyboard's mic instead.");
                    break;
                default:
                    fail("Listening stopped. Tap Start listening to try again.");
            }
        }
    };

    private void fail(String message) {
        wanted = false;
        active = false;
        emit("error", "message", message);
        emit("end", null, null);
    }

    private static String first(Bundle bundle) {
        if (bundle == null) return null;
        ArrayList<String> list = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return (list == null || list.isEmpty()) ? null : list.get(0);
    }

    private void emit(String type, String key, String value) {
        try {
            JSONObject o = new JSONObject().put("type", type);
            if (key != null) o.put(key, value);
            activity.sendToPage("__sioSpeech", o.toString());
        } catch (JSONException ignored) {
        }
    }
}
