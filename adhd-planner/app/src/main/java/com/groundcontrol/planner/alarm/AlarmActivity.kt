package com.groundcontrol.planner.alarm

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.groundcontrol.planner.container
import com.groundcontrol.planner.data.Task
import com.groundcontrol.planner.data.clockLabel
import com.groundcontrol.planner.ui.GroundControlTheme
import com.groundcontrol.planner.ui.Palette
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * What you see when the phone wakes you. One task, three answers, nothing else on screen.
 */
class AlarmActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()

        val taskId = intent?.getStringExtra(AlarmReceiver.EXTRA_TASK_ID)

        setContent {
            GroundControlTheme {
                var task by remember { mutableStateOf<Task?>(null) }
                LaunchedEffect(taskId) {
                    if (taskId != null) {
                        task = withContext(Dispatchers.IO) {
                            runCatching { applicationContext.container.repository.byId(taskId) }.getOrNull()
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background)
                        .padding(horizontal = 24.dp, vertical = 32.dp),
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = "ALARM" + (task?.time?.let { " · " + clockLabel(it) } ?: ""),
                        style = MaterialTheme.typography.labelMedium,
                        color = Palette.Signal,
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = task?.text ?: "Task due",
                        style = MaterialTheme.typography.headlineMedium,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    task?.firstStep?.let { step ->
                        Spacer(Modifier.height(14.dp))
                        Text(
                            text = "Start by — $step",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    Spacer(Modifier.height(40.dp))

                    Button(
                        onClick = { answer(taskId, AlarmActionReceiver.ACTION_DONE) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Palette.Ok),
                    ) { Text("Done") }

                    Spacer(Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        OutlinedButton(
                            onClick = { answer(taskId, AlarmActionReceiver.ACTION_SNOOZE) },
                            modifier = Modifier.weight(1f),
                        ) { Text("Snooze 10m") }
                        OutlinedButton(
                            onClick = { answer(taskId, AlarmActionReceiver.ACTION_STOP) },
                            modifier = Modifier.weight(1f),
                        ) { Text("Stop") }
                    }
                }
            }
        }
    }

    private fun answer(taskId: String?, action: String) {
        val intent = android.content.Intent(this, AlarmActionReceiver::class.java).apply {
            this.action = action
            putExtra(AlarmReceiver.EXTRA_TASK_ID, taskId)
        }
        sendBroadcast(intent)
        finish()
    }

    @Suppress("DEPRECATION")
    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
    }
}
