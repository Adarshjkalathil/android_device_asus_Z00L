package app.sayitonce;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;

/** Runs CoachApi against a local stand-in for the Claude API and checks the request and replies. */
public class CoachApiTest {

    private MockWebServer server;

    @Before
    public void start() throws Exception {
        server = new MockWebServer();
        server.start();
    }

    @After
    public void stop() throws Exception {
        server.shutdown();
    }

    private CoachApi api() {
        return new CoachApi(server.url("/").toString());
    }

    private static MockResponse json(int status, String body) {
        return new MockResponse().setResponseCode(status).setHeader("content-type", "application/json").setBody(body);
    }

    private static String message(String stopReason, String textJson) {
        return "{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-opus-5\","
                + "\"content\":[{\"type\":\"text\",\"text\":" + textJson + "}],"
                + "\"stop_reason\":\"" + stopReason + "\",\"stop_sequence\":null,"
                + "\"usage\":{\"input_tokens\":12,\"output_tokens\":8}}";
    }

    @Test
    public void sendsTheCoachRequestAndReturnsText() throws Exception {
        server.enqueue(json(200, message("end_turn", "\"{\\\"structure\\\":4}\"")));
        CoachApi.Result r = api().ask("sk-ant-test-key-123456", "Coach this answer.");

        assertTrue(r.message, r.ok);
        assertEquals("{\"structure\":4}", r.text);
        RecordedRequest req = server.takeRequest();
        String body = req.getBody().readUtf8();
        assertEquals("/v1/messages?beta=true", req.getPath());
        assertEquals("sk-ant-test-key-123456", req.getHeader("x-api-key"));
        assertTrue(req.getHeader("anthropic-beta"), req.getHeader("anthropic-beta").contains("server-side-fallback-2026-07-01"));
        assertTrue(body, body.contains("\"model\":\"claude-opus-5\""));
        assertTrue(body, body.contains("\"fallbacks\":\"default\""));
        assertTrue(body, body.contains("\"effort\":\"low\""));
        assertTrue(body, body.contains("Coach this answer."));
    }

    @Test
    public void refusalIsReported() {
        server.enqueue(json(200, message("refusal", "\"\"")));
        CoachApi.Result r = api().ask("sk-ant-test-key-123456", "x");
        assertFalse(r.ok);
        assertEquals("refused", r.code);
    }

    @Test
    public void rejectedKeyIsReported() {
        server.enqueue(json(401, "{\"type\":\"error\",\"error\":{\"type\":\"authentication_error\",\"message\":\"invalid x-api-key\"}}"));
        CoachApi.Result r = api().ask("sk-ant-bad-key-1234567", "x");
        assertFalse(r.ok);
        assertEquals("auth", r.code);
    }

    @Test
    public void missingKeyNeverCallsTheApi() {
        CoachApi.Result r = api().ask("", "x");
        assertFalse(r.ok);
        assertEquals("no_key", r.code);
        assertEquals(0, server.getRequestCount());
    }
}
