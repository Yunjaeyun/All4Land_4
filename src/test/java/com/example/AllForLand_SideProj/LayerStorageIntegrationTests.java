package com.example.AllForLand_SideProj;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("map-only")
class LayerStorageIntegrationTests {
    @Autowired private Environment environment;
    private static final String LAYER = """
        {"features":[{"id":1,"name":"Evening","month":9,"time":"23:00","visible":true,"photo":null,
          "shape":{"type":"polygon","color":"#247b65","path":[
            {"lat":51.5,"lng":-0.1},{"lat":51.6,"lng":-0.1},{"lat":51.5,"lng":-0.2}]}}]}
        """;

    private HttpClient client() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
    }
    private HttpResponse<String> request(HttpClient client, String method, String query, String body) throws Exception {
        var uri = URI.create("http://localhost:" + environment.getProperty("local.server.port") + "/api/custom-layers" + query);
        var builder = HttpRequest.newBuilder(uri);
        if (body == null) builder.GET();
        else builder.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void savedGeometrySurvivesRequestsAndIsIsolatedBySession() throws Exception {
        try (var first = client(); var second = client()) {
            assertEquals("{\"features\":[]}", request(first, "GET", "", null).body());
            assertEquals(200, request(first, "PUT", "", LAYER).statusCode());
            var restored = request(first, "GET", "", null);
            assertTrue(restored.body().contains("Evening"));
            assertTrue(restored.body().contains("polygon"));
            assertTrue(restored.body().contains("51.6"));
            assertEquals("{\"features\":[]}", request(second, "GET", "", null).body());
            assertEquals(200, request(first, "PUT", "", "{\"features\":[]}").statusCode());
            assertEquals("{\"features\":[]}", request(first, "GET", "", null).body());
        }
    }
    @Test
    void invalidSaveDoesNotOverwritePreviousSnapshotAndQuerySupportsMidnight() throws Exception {
        try (var client = client()) {
            assertEquals(200, request(client, "PUT", "", LAYER).statusCode());
            assertEquals(400, request(client, "PUT", "", LAYER.replace("51.6", "151.6")).statusCode());
            assertTrue(request(client, "GET", "", null).body().contains("51.6"));
            assertTrue(request(client, "GET", "?month=9&start=22:00&end=02:00", null).body().contains("Evening"));
            assertEquals("{\"features\":[]}", request(client, "GET", "?month=10", null).body());
            assertEquals("{\"features\":[]}", request(client, "GET", "?start=09:00&end=18:00", null).body());
            assertEquals(400, request(client, "GET", "?start=25:00&end=18:00", null).statusCode());
            assertEquals(400, request(client, "PUT", "", LAYER.replace("\"photo\":null", "\"photo\":\"blob:local-only\"")).statusCode());
        }
    }

    @Test
    void onePersonalLayerFiltersDifferentConditionsPerFeature() throws Exception {
        String document = """
            {"features":[
              {"id":1,"name":"Sunset","month":9,"time":"18:00","visible":true,"photo":null,
               "shape":{"type":"marker","color":"#247b65","position":{"lat":51.5,"lng":-0.1}}},
              {"id":2,"name":"Night","month":10,"time":"23:00","visible":true,"photo":null,
               "shape":{"type":"circle","color":"#247b65","position":{"lat":51.5,"lng":-0.1},"radius":100}}
            ]}
            """;
        try (var client = client()) {
            assertEquals(200, request(client, "PUT", "", document).statusCode());
            var filtered = request(client, "GET", "?month=9&start=17:00&end=19:00", null);
            assertTrue(filtered.body().contains("Sunset"));
            assertFalse(filtered.body().contains("Night"));
            assertTrue(request(client, "GET", "", null).body().contains("Night"));
            assertEquals(400, request(client, "PUT", "", document.replace("\"id\":2", "\"id\":1")).statusCode());
            assertTrue(request(client, "GET", "", null).body().contains("Night"));
            assertEquals(400, request(client, "PUT", "", "[]").statusCode());
        }
    }
}
