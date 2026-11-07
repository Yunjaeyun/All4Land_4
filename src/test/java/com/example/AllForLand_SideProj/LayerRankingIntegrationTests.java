package com.example.AllForLand_SideProj;

import java.net.URI;
import java.net.http.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("map-only")
class LayerRankingIntegrationTests {
    @Autowired private Environment environment;
    @Autowired private ObjectMapper mapper;
    @Test
    void demonstrationFeaturesIntersectActualRegions() throws Exception {
        String document;
        try (var in = new ClassPathResource("static/data/personal-ranking-example.json").getInputStream()) {
            document = new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        }
        var uri = URI.create("http://localhost:" + environment.getProperty("local.server.port") + "/api/custom-layers/ranking");
        try (var client = HttpClient.newHttpClient()) {
            var request = HttpRequest.newBuilder(uri).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(document)).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode(), response.body());
            var result = mapper.readTree(response.body());
            assertEquals(8, result.path("analyzedCount").asInt());
            assertEquals(8, result.path("matchedCount").asInt());
            assertEquals(0, result.path("outsideCount").asInt());
            assertTrue(result.path("regions").size() >= 3);
            assertEquals("Westminster", result.path("regions").get(0).path("borough").asString());
        }
    }
    @Test
    void actualMapBoundaryCanBeAnalyzedWithoutSavingOrDatabase() throws Exception {
        tools.jackson.databind.JsonNode first;
        try (var in = new ClassPathResource("static/data/london-lsoa-themes.json").getInputStream()) {
            first = mapper.readTree(in).path("features").get(0);
        }
        var coordinates = first.path("geometry").path("coordinates");
        while (coordinates.get(0).isArray()) coordinates = coordinates.get(0);
        String document = """
            {"features":[{"id":1,"name":"Boundary","month":9,"time":"18:00","visible":true,
            "shape":{"type":"marker","color":"#247b65","position":{"lat":%s,"lng":%s}}}]}
            """.formatted(coordinates.get(1), coordinates.get(0));
        String base = "http://localhost:" + environment.getProperty("local.server.port");
        try (var client = HttpClient.newHttpClient()) {
            var request = HttpRequest.newBuilder(URI.create(base + "/api/custom-layers/ranking"))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(document)).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode(), response.body());
            assertTrue(response.headers().firstValue("Cache-Control").orElseThrow().contains("no-store"));
            var result = mapper.readTree(response.body());
            assertEquals(1, result.path("analyzedCount").asInt());
            assertEquals(1, result.path("matchedCount").asInt());
            assertTrue(result.path("regions").toString().contains(first.path("properties").path("borough").asString()));
            var stored = client.send(HttpRequest.newBuilder(URI.create(base + "/api/custom-layers")).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals("{\"features\":[]}", stored.body());
            var bad = HttpRequest.newBuilder(URI.create(base + "/api/custom-layers/ranking?order=bad"))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(document)).build();
            assertEquals(400, client.send(bad, HttpResponse.BodyHandlers.ofString()).statusCode());
        }
    }
}
