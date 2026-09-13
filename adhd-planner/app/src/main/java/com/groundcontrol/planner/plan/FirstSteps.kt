package com.groundcontrol.planner.plan

/**
 * The task-initiation unblocker, done with rules rather than a model.
 *
 * A small language model asked for "one tiny first step" reliably answers
 * "Start by beginning the task", which helps nobody. A verb lookup is worse at
 * variety and much better at being concrete, which is the part that matters.
 */
object FirstSteps {

    private val rules: List<Pair<Regex, String>> = listOf(
        Regex("\\b(e-?mail|mail)\\b") to "Open your mail app and start the draft",
        Regex("\\b(reply|respond|answer|get back to)\\b") to "Open the thread and read the last message",
        Regex("\\b(call|phone|ring)\\b") to "Find the number and put it on screen",
        Regex("\\b(text|message|whatsapp|dm)\\b") to "Open the chat and type one line",
        Regex("\\b(book|appointment|reserve|schedule)\\b") to "Open the booking page or dial the number",
        Regex("\\b(pay|bill|invoice|rent|transfer)\\b") to "Open the banking app and find the payee",
        Regex("\\b(buy|groceries|shopping|shop|order)\\b") to "Write the first three items on the list",
        Regex("\\b(write|draft|report|essay|blog|document)\\b") to "Open the document and write one bad sentence",
        Regex("\\b(read|review|study|revise)\\b") to "Open it and read the first paragraph only",
        Regex("\\b(clean|tidy|declutter|wash|laundry|dishes)\\b") to "Clear one surface and stop there",
        Regex("\\b(gym|run|walk|workout|exercise|yoga|swim)\\b") to "Put the shoes by the door",
        Regex("\\b(doctor|dentist|prescription|pharmacy|medicine|refill)\\b") to "Find the number in your contacts",
        Regex("\\b(fix|repair|install|assemble)\\b") to "Put the tool and the broken thing on the table",
        Regex("\\b(pack|luggage|suitcase)\\b") to "Put the empty bag on the bed",
        Regex("\\b(plan|research|look into|figure out|decide)\\b") to "Open a note and write the question at the top",
        Regex("\\b(print|scan|upload|submit|send|file)\\b") to "Find the file and open it",
        Regex("\\b(meet|meeting|catch up|coffee|lunch|dinner|drinks)\\b") to "Send one message proposing a time",
        Regex("\\b(renew|register|apply|visa|passport|licence|license)\\b") to "Open the form and fill only the name field",
        Regex("\\b(water|plants|feed|bin|rubbish|trash)\\b") to "Pick the thing up and carry it",
        Regex("\\b(code|bug|deploy|refactor|test|pull request|pr)\\b") to "Open the file and read the failing line",
    )

    fun suggest(text: String): String? {
        val lower = text.lowercase()
        return rules.firstOrNull { it.first.containsMatchIn(lower) }?.second
    }
}
