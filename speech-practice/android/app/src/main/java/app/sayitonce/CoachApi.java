package app.sayitonce;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.models.beta.messages.BetaContentBlock;
import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.models.beta.messages.BetaOutputConfig;
import com.anthropic.models.beta.messages.BetaStopReason;
import com.anthropic.models.beta.messages.MessageCreateParams;

import java.time.Duration;

/** Sends one coaching prompt to the Claude API. Plain Java, so it can be unit tested off-device. */
final class CoachApi {

    static final String MODEL = "claude-opus-5";

    /** Outcome of one request. On failure, code is one the page knows how to explain. */
    static final class Result {
        final boolean ok;
        final String text;
        final String code;
        final String message;

        private Result(boolean ok, String text, String code, String message) {
            this.ok = ok;
            this.text = text;
            this.code = code;
            this.message = message;
        }

        static Result text(String text) { return new Result(true, text, null, null); }
        static Result error(String code, String message) { return new Result(false, null, code, message); }
    }

    private final String baseUrl;
    private AnthropicClient client;
    private String clientKey;

    /** baseUrl is null for the real API; tests pass a local server. */
    CoachApi(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    private synchronized AnthropicClient client(String key) {
        if (client == null || !key.equals(clientKey)) {
            AnthropicOkHttpClient.Builder b = AnthropicOkHttpClient.builder()
                    .apiKey(key)
                    .timeout(Duration.ofSeconds(120));
            if (baseUrl != null) b.baseUrl(baseUrl);
            client = b.build();
            clientKey = key;
        }
        return client;
    }

    Result ask(String key, String prompt) {
        if (key == null || key.isEmpty()) return Result.error("no_key", "No API key saved.");
        try {
            MessageCreateParams params = MessageCreateParams.builder()
                    .model(MODEL)
                    .maxTokens(16000L)
                    // Short coaching replies: low effort keeps the wait short.
                    .outputConfig(BetaOutputConfig.builder().effort(BetaOutputConfig.Effort.LOW).build())
                    // If Claude declines, let the API retry on its recommended fallback model.
                    .addBeta("server-side-fallback-2026-07-01")
                    .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                    .addUserMessage(prompt)
                    .build();
            BetaMessage message = client(key).beta().messages().create(params);

            if (message.stopReason().isPresent()
                    && message.stopReason().get().equals(BetaStopReason.REFUSAL)) {
                return Result.error("refused", "The coach declined this answer.");
            }
            StringBuilder text = new StringBuilder();
            for (BetaContentBlock block : message.content()) {
                block.text().ifPresent(t -> text.append(t.text()));
            }
            if (text.length() == 0) return Result.error("empty_completion", "The coach returned no text.");
            return Result.text(text.toString());
        } catch (UnauthorizedException | PermissionDeniedException e) {
            return Result.error("auth", "The API key was rejected.");
        } catch (RateLimitException e) {
            return Result.error("rate_limited", "Too many requests.");
        } catch (AnthropicServiceException e) {
            return Result.error("upstream_error", String.valueOf(e.getMessage()));
        } catch (AnthropicIoException e) {
            return Result.error("network", "Could not reach the API.");
        } catch (RuntimeException e) {
            return Result.error("upstream_error", String.valueOf(e.getMessage()));
        }
    }
}
