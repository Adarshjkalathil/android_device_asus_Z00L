# Ground Control

An ADHD planner for Android. You type the pile that is in your head, it comes back as
separate tasks with dates, times and honest length estimates, and it rings a real alarm
before each one.

This is the native counterpart to the Ground Control web board. The web version can do
almost everything here except the one thing that matters most: a web page cannot ring when
it is closed. `AlarmManager.setAlarmClock` can, through a locked and sleeping phone, which
is the entire reason this app exists.

## What it does

**Capture without friction.** Type or paste a brain dump and press File it. Compound lines
are split into separate strips. You can also capture from any other app through the share
sheet or the text-selection menu, without opening this one.

**Real alarms.** Anything with a date and a time gets an alarm, defaulting to fifteen
minutes ahead. When it fires the phone rings on the alarm stream, so it is heard through
silent mode, vibrates, wakes the screen, and shows one task with three answers: Done,
Snooze 10 minutes, Stop. All three work straight from the notification without unlocking.
Alarms are re-laid after a reboot, a reinstall, a clock change and a timezone change.

**An honest read on the day.** Every strip carries a duration estimate, so each day shows a
stacked load bar and tells you plainly when you have planned more than fits.

**One thing at a time.** The Now card shows a single next task and the tiny physical first
step that starts it.

**A home-screen widget.** What is next, with no app to open.

**Editing in plain words.** Open any strip and type "push to friday 3pm, 90 minutes, remind
me an hour before". The change is shown to you in words before anything is written.

## How the parsing works, and why

Dates, clock times, durations, urgency and alarm lead times are arithmetic, not language.
`RulesPlanner` does all of it on the phone with regular expressions and `java.time`: instant,
free, and correct with the radio off. Twenty lines of date maths beat any small model at
"next Friday", and a 1B model asked for a first step reliably answers "Start by beginning
the task", which helps nobody, so `FirstSteps` uses a verb lookup instead.

`Planner` is the seam. `ClaudePlanner` implements the same interface and does a better job
of wording and first steps when an API key is set, and `FallbackPlanner` drops to the rules
engine the moment anything goes wrong: no key, no signal, a refusal, a reply that will not
parse. Capture never waits on a network round trip. Enrichment, meaning a better category
and a first step, is queued through WorkManager and fills in later.

The app is fully usable with no key and no network. That is the default.

## Building

Needs JDK 17 or newer and an Android SDK with platform 35.

```
echo "sdk.dir=/path/to/Android/sdk" > local.properties
./gradlew assembleDebug
```

The APK lands in `app/build/outputs/apk/debug/`.

## Permissions, and what each is for

| Permission | Why |
|---|---|
| `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` | Alarms that fire at the minute rather than whenever the system feels like it. A reminder app is exactly the case these were meant for. |
| `USE_FULL_SCREEN_INTENT` | Showing the alarm over a locked screen. |
| `POST_NOTIFICATIONS` | The alarm notification and its Done / Snooze / Stop actions. |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE` | Keeping the sound alive while the alarm is ringing. |
| `WAKE_LOCK`, `VIBRATE` | Waking the phone and buzzing. |
| `RECEIVE_BOOT_COMPLETED` | Re-laying alarms after a restart. |
| `INTERNET` | Only used when an API key is set. With no key the app never opens a socket. |

On Android 12 and 13 exact alarms can be refused by the user. Settings shows a warning and a
button straight to the system screen when that happens; reminders still arrive, just less
precisely.

## Where things live

```
data/       Room entity, DAO, database, repository. Every write re-syncs alarms and the widget.
plan/       Planner interface, the offline rules engine, first-step heuristics, the Claude client.
alarm/      Scheduler, receivers, the ringing foreground service, the lock-screen alarm screen.
ui/         Compose board, amend sheet, settings, theme.
work/       WorkManager enrichment queue.
share/      Share-sheet and text-selection capture.
widget/     Home-screen "next up" widget.
```

## A note on the API key

The key is stored in this app's private preferences and used to call the Anthropic API
directly from the phone. That is reasonable for a personal sideloaded build and wrong for
anything you publish, where the call belongs behind a server you control. Leave the field
empty and the app runs entirely on its own rules.
