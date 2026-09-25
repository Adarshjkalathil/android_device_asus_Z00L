# Say It Once

A daily speaking practice app for quiet, fast or unstructured speakers, designed with ADHD in mind.
It trains three things: **volume** (a loud routine modeled on LSVT LOUD), **clarity** (a phone
dictation test and clear-speech cues) and **structure** (answer-first shapes like PREP and STAR,
plus Toastmasters-style Table Topics).

- `say-it-once.html` is the whole app: one page, no build step. Open it in Chrome to use it.
- `android/` wraps the same page in a native Android app (minimum Android 8.0) and adds a real
  microphone meter, Android speech-to-text, daily reminders and optional coach feedback.

## Install the Android app

1. Download `app-debug.apk` (from the GitHub Actions run named "Say It Once APK", or build it below).
2. Open it on your phone and allow installing from this source when Android asks.
3. On first use of "Start listening" or the mic meter, allow microphone access.

Coach feedback is optional: paste an Anthropic API key in **Progress → App settings**. The key is
stored only on the phone and excluded from backups. Usage is billed to that API account.

## Build

```sh
cd speech-practice/android
export ANDROID_HOME=/path/to/android-sdk   # needs platform 35 and build-tools 35.0.0
./gradlew testDebugUnitTest assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

The build copies `../say-it-once.html` into the APK as `assets/index.html`, so edit the page in
one place and both versions stay in sync.
