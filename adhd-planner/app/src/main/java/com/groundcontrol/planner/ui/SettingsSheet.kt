package com.groundcontrol.planner.ui

import android.content.Intent
import android.os.Build
import android.provider.Settings as AndroidSettings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
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
import androidx.compose.ui.unit.dp
import com.groundcontrol.planner.alarm.AlarmScheduler
import com.groundcontrol.planner.data.remindLabel

private val LEAD_CHOICES = listOf(0, 5, 15, 30, 60)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsSheet(vm: BoardViewModel) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current
    var keyDraft by remember { mutableStateOf(vm.apiKey) }
    val exactAllowed = remember { AlarmScheduler(context).canScheduleExact() }

    ModalBottomSheet(
        onDismissRequest = { vm.showSettings = false },
        sheetState = state,
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("SETTINGS", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)

            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Alarms", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Rings on the alarm stream, through silent mode and a locked screen.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(checked = vm.alarmsEnabled, onCheckedChange = { vm.updateAlarmsEnabled(it) })
            }

            if (!exactAllowed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "Android is not letting this app set exact alarms, so reminders may arrive late.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                    )
                    Button(onClick = {
                        runCatching {
                            context.startActivity(
                                Intent(AndroidSettings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                                    .setData(android.net.Uri.parse("package:" + context.packageName))
                            )
                        }
                    }) { Text("Allow exact alarms") }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Default alarm for anything with a time", style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LEAD_CHOICES.forEach { minutes ->
                        TextButton(onClick = { vm.updateDefaultLead(minutes) }) {
                            Text(
                                remindLabel(minutes),
                                color = if (vm.defaultLead == minutes) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.fillMaxWidth())

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Wording help (optional)", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Dates, times, lengths and alarms are always worked out on this phone, offline. " +
                        "An Anthropic API key only improves the wording and the first steps, and the app " +
                        "falls back to its own rules whenever the network is not there.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = keyDraft,
                    onValueChange = { keyDraft = it },
                    label = { Text("Anthropic API key") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { vm.updateApiKey(keyDraft) }) { Text("Save key") }
                    TextButton(onClick = {
                        keyDraft = ""
                        vm.updateApiKey("")
                    }) { Text("Remove") }
                }
            }

            Row {
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { vm.showSettings = false }) { Text("Close") }
            }
        }
    }
}
