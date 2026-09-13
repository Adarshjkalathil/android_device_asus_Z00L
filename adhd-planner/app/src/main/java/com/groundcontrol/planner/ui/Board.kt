package com.groundcontrol.planner.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.groundcontrol.planner.data.Categories
import com.groundcontrol.planner.data.ISO_DAY
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.data.alarmAt
import com.groundcontrol.planner.data.clockLabel
import com.groundcontrol.planner.data.durationLabel
import com.groundcontrol.planner.data.isLate
import com.groundcontrol.planner.data.remindLabel
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val DayHeading: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE d MMM")
private val Stamp: DateTimeFormatter = DateTimeFormatter.ofPattern("EEEE, d MMM")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BoardScreen(vm: BoardViewModel) {
    val all by vm.tasks.collectAsState()
    val dark = MaterialTheme.colorScheme.background == Palette.DeskDark

    LaunchedEffect(vm.status) {
        if (vm.status != null) {
            kotlinx.coroutines.delay(6000)
            vm.clearStatus()
        }
    }

    Scaffold(containerColor = MaterialTheme.colorScheme.background) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item { Masthead(vm) }
            item { CaptureConsole(vm) }
            item { NowCard(vm, all, dark) }
            item { ViewTabs(vm) }

            when (vm.view) {
                BoardView.TODAY -> todayBoard(vm, all, dark)
                BoardView.WEEK -> weekBoard(vm, all, dark)
                BoardView.PARKED -> parkedBoard(vm, all, dark)
            }

            item { Spacer(Modifier.height(40.dp)) }
        }
    }

    vm.editing?.let { draft -> AmendSheet(vm, draft) }
    if (vm.showSettings) SettingsSheet(vm)
}

@Composable
private fun Masthead(vm: BoardViewModel) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                "GROUND CONTROL",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                LocalDate.now().format(Stamp),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        TextButton(onClick = { vm.showSettings = true }) { Text("Settings") }
    }
}

@Composable
private fun CaptureConsole(vm: BoardViewModel) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(4.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = vm.capture,
                onValueChange = { vm.capture = it },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                placeholder = {
                    Text(
                        "Everything in your head, any order — dentist tomorrow 9am, " +
                            "report due friday urgent, groceries, gym twice this week",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                },
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    vm.status.orEmpty(),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = { vm.fileIt() }, enabled = !vm.filing && vm.capture.isNotBlank()) {
                    Text(if (vm.filing) "FILING…" else "FILE IT", style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}

@Composable
private fun NowCard(vm: BoardViewModel, all: List<Task>, dark: Boolean) {
    val task = vm.nowTask(all)
    val next = vm.nextAlarm(all)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "NOW",
                style = MaterialTheme.typography.labelMedium,
                color = if (dark) Palette.SignalDark else Palette.Signal,
            )
            Spacer(Modifier.weight(1f))
            Text(
                text = when {
                    !vm.alarmsEnabled -> "alarms off"
                    next != null -> "next alarm " + next.second.format(DateTimeFormatter.ofPattern("EEE HH:mm"))
                    else -> "no alarms set"
                },
                style = MaterialTheme.typography.labelSmall,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(4.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        ) {
            if (task == null) {
                Text(
                    if (all.isEmpty()) "Nothing filed yet. Dump a few things above and they land here, one at a time."
                    else "Today's board is clear. Rest, or pull something up from Parked.",
                    modifier = Modifier.padding(16.dp),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
                    Checkbox(checked = task.done, onCheckedChange = { vm.toggleDone(task) })
                    Column(Modifier.weight(1f).padding(start = 4.dp)) {
                        Text(task.text, style = MaterialTheme.typography.titleLarge)
                        task.firstStep?.let {
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "Start by — $it",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        MetaRow(task, dark)
                    }
                    TextButton(onClick = { vm.openEditor(task) }) { Text("Edit") }
                }
            }
        }
    }
}

@Composable
private fun ViewTabs(vm: BoardViewModel) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(4.dp))
            .clip(RoundedCornerShape(4.dp)),
    ) {
        listOf(
            BoardView.TODAY to "TODAY",
            BoardView.WEEK to "THE WEEK",
            BoardView.PARKED to "PARKED",
        ).forEach { (value, label) ->
            val selected = vm.view == value
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(
                        if (selected) MaterialTheme.colorScheme.surface
                        else MaterialTheme.colorScheme.surfaceVariant
                    )
                    .clickable { vm.switchView(value) }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (selected) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.todayBoard(
    vm: BoardViewModel,
    all: List<Task>,
    dark: Boolean,
) {
    val list = vm.todayList(all)
    item { BayHeading("TODAY", list, vm) }
    item { LoadMeter(vm.plannedMinutes(list), list, dark) }
    if (list.isEmpty()) {
        item { Quiet("Nothing on today. Pull something up from Parked, or dump more above.") }
    } else {
        items(list, key = { it.id }) { task -> StripRow(vm, task, dark) }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.weekBoard(
    vm: BoardViewModel,
    all: List<Task>,
    dark: Boolean,
) {
    val today = LocalDate.now()
    for (offset in 0L until 7L) {
        val day = today.plusDays(offset)
        val list = vm.dayList(all, day)
        item(key = "head-" + day.format(ISO_DAY)) {
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.Bottom) {
                Text(
                    if (offset == 0L) "TODAY" else day.format(DateTimeFormatter.ofPattern("EEEE")).uppercase(),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    day.format(DayHeading) + durationLabel(vm.plannedMinutes(list)).let { if (it.isBlank()) "" else " · $it" },
                    style = MaterialTheme.typography.labelSmall,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        if (list.isEmpty()) {
            item(key = "empty-" + day.format(ISO_DAY)) { Quiet("Clear") }
        } else {
            items(list, key = { it.id }) { task -> StripRow(vm, task, dark) }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.parkedBoard(
    vm: BoardViewModel,
    all: List<Task>,
    dark: Boolean,
) {
    val list = vm.parkedList(all)
    item { BayHeading("PARKED", list, vm) }
    if (list.isEmpty()) {
        item {
            Quiet("Nothing parked. Anything without a day lands here — it is a safe place to leave things.")
        }
    } else {
        items(list, key = { it.id }) { task -> StripRow(vm, task, dark) }
    }
}

@Composable
private fun BayHeading(label: String, list: List<Task>, vm: BoardViewModel) {
    val done = list.filter { it.done }
    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onBackground)
        Spacer(Modifier.width(10.dp))
        Text(
            "${list.size}",
            style = MaterialTheme.typography.labelSmall,
            fontFamily = FontFamily.Monospace,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.weight(1f))
        if (done.isNotEmpty()) {
            TextButton(onClick = { vm.clearDone(done.map { it.id }) }) {
                Text("clear ${done.size} done", style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun LoadMeter(minutes: Int, list: List<Task>, dark: Boolean) {
    if (list.none { !it.done }) return
    val scale = maxOf(480, minutes)
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
        ) {
            list.filter { !it.done }.forEach { task ->
                Box(
                    Modifier
                        .weight(((task.durationMinutes ?: 10).toFloat() / scale).coerceAtLeast(0.01f))
                        .fillMaxHeight()
                        .background(Palette.category(task.category, dark)),
                )
            }
            Spacer(Modifier.weight(maxOf(0.01f, 1f - minutes.toFloat() / scale)))
        }
        Text(
            text = durationLabel(minutes) + " planned" + when {
                minutes > 480 -> " — more than fits, park something"
                minutes > 330 -> " — heavy day"
                else -> " — room to spare"
            },
            style = MaterialTheme.typography.labelSmall,
            fontFamily = FontFamily.Monospace,
            color = when {
                minutes > 480 -> MaterialTheme.colorScheme.error
                minutes > 330 -> if (dark) Palette.SignalDark else Palette.Signal
                else -> MaterialTheme.colorScheme.onSurfaceVariant
            },
        )
    }
}

@Composable
private fun StripRow(vm: BoardViewModel, task: Task, dark: Boolean) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(4.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (task.isLate()) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.outline,
        ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            Box(
                Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(Palette.category(task.category, dark))
            )
            Row(
                modifier = Modifier.padding(vertical = 8.dp, horizontal = 8.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Checkbox(checked = task.done, onCheckedChange = { vm.toggleDone(task) })
                Column(
                    Modifier
                        .weight(1f)
                        .padding(start = 2.dp)
                        .clickable { vm.openEditor(task) }
                ) {
                    Text(
                        task.text,
                        style = MaterialTheme.typography.bodyLarge,
                        textDecoration = if (task.done) TextDecoration.LineThrough else null,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.height(4.dp))
                    MetaRow(task, dark)
                }
                TextButton(onClick = { vm.openEditor(task) }) {
                    Text("edit", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun MetaRow(task: Task, dark: Boolean) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            Categories.label(task.category).uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = Palette.category(task.category, dark),
        )
        task.time?.let {
            Text(
                clockLabel(it),
                style = MaterialTheme.typography.labelSmall,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        durationLabel(task.durationMinutes).takeIf { it.isNotBlank() }?.let {
            Text(
                it,
                style = MaterialTheme.typography.labelSmall,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (task.alarmAt() != null) {
            Text(
                remindLabel(task.remindMinutesBefore),
                style = MaterialTheme.typography.labelSmall,
                color = if (dark) Palette.SignalDark else Palette.Signal,
            )
        }
        if (task.isLate()) {
            Text(
                "LATE",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}

@Composable
private fun Quiet(text: String) {
    Text(
        text,
        modifier = Modifier.padding(vertical = 6.dp),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
fun SectionDivider() {
    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
}

/** Kept for the widget preview tooling; harmless at runtime. */
internal val TransparentBox: Color = Color.Transparent
