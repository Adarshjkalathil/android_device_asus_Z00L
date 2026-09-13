package com.groundcontrol.planner.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.groundcontrol.planner.data.Categories
import com.groundcontrol.planner.data.ISO_DAY
import com.groundcontrol.planner.data.ISO_TIME
import com.groundcontrol.planner.data.Priorities
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.data.clockLabel
import com.groundcontrol.planner.data.remindLabel
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

private val REMIND_CHOICES = listOf<Int?>(null, 0, 5, 15, 30, 60, 120, 1440)
private val SheetDate: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE d MMM yyyy")

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AmendSheet(vm: BoardViewModel, draft: Task) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current
    var confirmingDelete by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = { vm.closeEditor() },
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("AMEND STRIP", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)

            OutlinedTextField(
                value = draft.text,
                onValueChange = { next -> vm.editDraft { it.copy(text = next) } },
                label = { Text("Task") },
                modifier = Modifier.fillMaxWidth(),
            )

            // ---- when ----
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = {
                        val current = runCatching { LocalDate.parse(draft.day.orEmpty(), ISO_DAY) }.getOrDefault(LocalDate.now())
                        DatePickerDialog(
                            context,
                            { _, y, m, d ->
                                vm.editDraft { it.copy(day = LocalDate.of(y, m + 1, d).format(ISO_DAY)) }
                            },
                            current.year, current.monthValue - 1, current.dayOfMonth,
                        ).show()
                    },
                ) {
                    Text(
                        draft.day?.let { runCatching { LocalDate.parse(it, ISO_DAY).format(SheetDate) }.getOrDefault(it) }
                            ?: "No date",
                    )
                }
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    enabled = draft.day != null,
                    onClick = {
                        val current = runCatching { LocalTime.parse(draft.time.orEmpty(), ISO_TIME) }.getOrDefault(LocalTime.of(9, 0))
                        TimePickerDialog(
                            context,
                            { _, h, min -> vm.editDraft { it.copy(time = LocalTime.of(h, min).format(ISO_TIME)) } },
                            current.hour, current.minute, true,
                        ).show()
                    },
                ) {
                    Text(draft.time?.let { clockLabel(it) } ?: "No time")
                }
            }

            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TextButton(onClick = { vm.editDraft { it.copy(day = LocalDate.now().format(ISO_DAY)) } }) { Text("today") }
                TextButton(onClick = { vm.editDraft { it.copy(day = LocalDate.now().plusDays(1).format(ISO_DAY)) } }) { Text("tomorrow") }
                TextButton(onClick = { vm.editDraft { it.copy(day = LocalDate.now().plusWeeks(1).format(ISO_DAY)) } }) { Text("+1 week") }
                TextButton(onClick = { vm.editDraft { it.copy(day = null, time = null, remindMinutesBefore = null) } }) { Text("no date") }
                if (draft.time != null) {
                    TextButton(onClick = { vm.editDraft { it.copy(time = null, remindMinutesBefore = null) } }) { Text("clear time") }
                }
            }

            // ---- alarm ----
            PickerRow(
                label = "Alarm",
                current = remindLabel(draft.remindMinutesBefore),
                enabled = draft.day != null && draft.time != null,
                options = REMIND_CHOICES.map { remindLabel(it) },
                onPick = { index -> vm.editDraft { it.copy(remindMinutesBefore = REMIND_CHOICES[index]) } },
            )
            if (draft.day == null || draft.time == null) {
                Text(
                    "An alarm needs a date and a time. Give it both and this phone will ring " +
                        "through a locked screen, like a clock app.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Box(Modifier.weight(1f)) {
                    PickerRow(
                        label = "Category",
                        current = Categories.label(draft.category),
                        options = Categories.all.map { Categories.label(it) },
                        onPick = { index -> vm.editDraft { it.copy(category = Categories.all[index]) } },
                    )
                }
                Box(Modifier.weight(1f)) {
                    PickerRow(
                        label = "Priority",
                        current = Priorities.label(draft.priority),
                        options = Priorities.all.map { Priorities.label(it) },
                        onPick = { index -> vm.editDraft { it.copy(priority = Priorities.all[index]) } },
                    )
                }
            }

            OutlinedTextField(
                value = draft.durationMinutes?.toString().orEmpty(),
                onValueChange = { next ->
                    val parsed = next.filter { it.isDigit() }.take(3).toIntOrNull()
                    vm.editDraft { it.copy(durationMinutes = parsed) }
                },
                label = { Text("Minutes") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = draft.firstStep.orEmpty(),
                onValueChange = { next -> vm.editDraft { it.copy(firstStep = next.ifBlank { null }) } },
                label = { Text("First step") },
                placeholder = { Text("one tiny physical thing that starts it") },
                modifier = Modifier.fillMaxWidth(),
            )

            // ---- plain language ----
            Text(
                "Or just say it — push to friday 3pm, 90 minutes, remind me an hour before",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = vm.amendWords,
                    onValueChange = { vm.amendWords = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    placeholder = { Text("what should change?") },
                )
                Button(onClick = { vm.amendInWords() }, enabled = !vm.amending && vm.amendWords.isNotBlank()) {
                    Text(if (vm.amending) "…" else "Apply")
                }
            }
            vm.amendStatus?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Spacer(Modifier.height(4.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(
                    onClick = {
                        if (confirmingDelete) vm.delete(draft) else confirmingDelete = true
                    },
                ) {
                    Text(
                        if (confirmingDelete) "tap again to delete" else "delete",
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { vm.closeEditor() }) { Text("Cancel") }
                Spacer(Modifier.height(0.dp))
                Button(onClick = { vm.saveEditor() }) { Text("Save") }
            }
        }
    }
}

@Composable
private fun PickerRow(
    label: String,
    current: String,
    options: List<String>,
    enabled: Boolean = true,
    onPick: (Int) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Column {
        Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick = { open = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
            Text(current)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEachIndexed { index, option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        open = false
                        onPick(index)
                    },
                )
            }
        }
    }
}
