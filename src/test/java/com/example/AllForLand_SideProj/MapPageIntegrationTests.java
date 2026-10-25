package com.example.AllForLand_SideProj;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("map-only")
class MapPageIntegrationTests {
    @Autowired
    private Environment environment;

    private HttpResponse<String> get(String path) throws Exception {
        var uri = URI.create("http://localhost:" + environment.getProperty("local.server.port") + path);
        try (var client = HttpClient.newHttpClient()) {
            return client.send(HttpRequest.newBuilder(uri).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
        }
    }

    @Test
    void mapRendersThemesAndCustomLayerComponentsTogether() throws Exception {
        var response = get("/");
        assertEquals(200, response.statusCode());
        var html = response.body();
        for (var expected : new String[] { "data-menu=\"custom-layer\"", "id=\"map-panel\"",
                "id=\"custom-layer-panel\"", "data-theme=\"greenspace\"", "data-theme=\"population\"",
                "id=\"layer-register\"", "id=\"layer-query-form\"", "new window.CustomLayerDraw(map)",
                "data-menu=\"restaurant\"", "id=\"restaurant-panel\"", "id=\"restaurant-form\"", "id=\"restaurant-list\"", "initRestaurants(map)" }) {
            assertTrue(html.contains(expected), expected);
        }
        for (var resource : new String[] { "/js/custom-layer/panel.js", "/js/custom-layer/draw.js",
                "/css/navigation.css", "/css/custom-layer/panel.css",
                "/js/restaurant/restaurant.js", "/css/restaurant/panel.css" }) {
            assertTrue(html.contains(resource));
            assertEquals(200, get(resource).statusCode(), resource);
        }
    }

    @Test
    void customLayerEntryRedirectsToSharedMap() throws Exception {
        var response = get("/custom-layers");
        assertEquals(302, response.statusCode());
        assertTrue(response.headers().firstValue("location").orElseThrow().endsWith("/?menu=custom-layer"));
    }
}
