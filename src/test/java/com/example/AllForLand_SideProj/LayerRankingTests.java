package com.example.AllForLand_SideProj;

import com.example.AllForLand_SideProj.customlayer.ranking.*;
import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument;
import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.*;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

class LayerRankingTests {
    private LayerRankingService service;
    // Alpha has two adjacent LSOAs; Beta has a MultiPolygon; Alpha's first LSOA has a hole.
    private static final String DATA = """
        {"metadata":{"indicators":{"safety":{"breaks":[10,20,30,40]}}},"features":[
        {"properties":{"code":"A1","borough":"Alpha","crimeCount":10,"population":100},
         "geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]],[[0.2,0.2],[0.2,0.4],[0.4,0.4],[0.4,0.2],[0.2,0.2]]]}},
        {"properties":{"code":"A2","borough":"Alpha","crimeCount":10,"population":900},
         "geometry":{"type":"Polygon","coordinates":[[[1,0],[2,0],[2,1],[1,1],[1,0]]]}},
        {"properties":{"code":"B","borough":"Beta","crimeCount":1,"population":100},
         "geometry":{"type":"MultiPolygon","coordinates":[[[[2,0],[3,0],[3,1],[2,1],[2,0]]],[[[4,0],[5,0],[5,1],[4,1],[4,0]]]]}},
        {"properties":{"code":"C","borough":"Gamma","crimeCount":null,"population":null},
         "geometry":{"type":"Polygon","coordinates":[[[0,2],[1,2],[1,3],[0,3],[0,2]]]}}
        ]}
        """;
    @BeforeEach
    void setup() throws Exception {
        service = new LayerRankingService(new RegionCatalog(JsonMapper.builder().build(),
            new ByteArrayInputStream(DATA.getBytes(StandardCharsets.UTF_8))));
    }
    private Shape point(double lat, double lng) { return new Shape("marker", "#247b65", null, new Point(lat, lng), null, null); }
    private Feature item(long id, Shape shape) { return new Feature(id, "Item " + id, 9, "18:00", true, null, shape); }
    private LayerRankingService.Result rank(String order, Feature... items) { return service.rank(new LayerDocument(List.of(items)), order); }
    private Map<String, Integer> counts(LayerRankingService.Result result) {
        return result.regions().stream().collect(Collectors.toMap(LayerRankingService.Entry::borough, LayerRankingService.Entry::count));
    }
    @Test
    void sharedBoundaryCountsBothRegionsButRepeatedLsoasNeverDoubleCount() {
        var line = new Shape("polyline", "#247b65", List.of(new Point(.5, .5), new Point(.5, 4.5)), null, null, null);
        var result = rank("interest", item(1, point(.5, 2)), item(2, line));
        assertEquals(Map.of("Alpha", 2, "Beta", 2), counts(result));
        result.regions().forEach(region -> assertEquals(List.of(1L, 2L), region.featureIds()));
        assertEquals(2, result.analyzedCount());
        assertEquals(2, result.matchedCount());
        assertEquals("Beta", result.regions().getFirst().borough()); // safer tie-break
        assertEquals(20.0, result.regions().stream().filter(r -> r.borough().equals("Alpha")).findFirst().orElseThrow().incidentRate());
    }
    @Test
    void polygonRectangleAndCircleCountAcrossEdgesIncludingCircleTangency() {
        var rectangle = new Shape("rectangle", "#247b65", null, null, new Bounds(.8, .6, 2.2, 1.8), null);
        var polygon = new Shape("polygon", "#247b65", List.of(new Point(.5, 1.8), new Point(.5, 2.2), new Point(.7, 2.0)), null, null, null);
        // Centre belongs to Alpha only. Radius just touches Beta's corner at (2, 0).
        var circle = new Shape("circle", "#247b65", null, new Point(0.0, 1.9), null, Math.toRadians(.1) * 6371008.8);
        assertEquals(Map.of("Alpha", 3, "Beta", 3), counts(rank("interest", item(1, rectangle), item(2, polygon), item(3, circle))));
        var shortCircle = new Shape("circle", "#247b65", null, circle.position(), null, circle.radius() - 2);
        assertEquals(Map.of("Alpha", 1), counts(rank("interest", item(1, shortCircle))));
    }
    @Test
    void holesOutsideAndHiddenItemsAreExcludedAndDistinctIdsAtSameLocationCountIndividually() {
        var hidden = new Feature(5, "Hidden", 9, "18:00", false, null, point(.5, 2.5));
        var result = rank("interest", item(1, point(.3, .3)), item(2, point(10, 10)),
            item(3, point(.5, 1.5)), item(4, point(.5, 1.5)), hidden);
        assertEquals(Map.of("Alpha", 2), counts(result));
        assertEquals(4, result.analyzedCount());
        assertEquals(2, result.outsideCount());
        var smallCircle = new Shape("circle", "#247b65", null, new Point(.3, .3), null, 100.0);
        assertTrue(rank("interest", item(1, smallCircle)).regions().isEmpty());
        var reachesHoleEdge = new Shape("circle", "#247b65", null, smallCircle.position(), null, 12000.0);
        assertEquals(Map.of("Alpha", 1), counts(rank("interest", item(1, reachesHoleEdge))));
    }
    @Test
    void sortingIsExplicitAndMissingSafetyDoesNotBecomeSafeZero() {
        Feature[] items = { item(1, point(.5, 1.5)), item(2, point(.6, 1.5)), item(3, point(.5, 2.5)), item(4, point(2.5, .5)) };
        assertEquals("Alpha", rank("interest", items).regions().getFirst().borough());
        var safer = rank("safety", items).regions();
        assertEquals("Beta", safer.getFirst().borough());
        assertEquals("Gamma", safer.getLast().borough());
        assertNull(safer.getLast().incidentRate());
        assertTrue(rank("interest").regions().isEmpty());
    }
    @Test
    void malformedShapesDuplicateIdsAndUnknownSortAreRejected() {
        var polygon = new Shape("polygon", "#247b65", List.of(new Point(0., 0.), new Point(1., 1.), new Point(0., 1.), new Point(1., 0.)), null, null, null);
        assertThrows(RuntimeException.class, () -> rank("interest", item(1, polygon)));
        assertThrows(RuntimeException.class, () -> rank("interest", item(1, point(.5, .5)), item(1, point(.5, .5))));
        assertThrows(IllegalArgumentException.class, () -> rank("unknown"));
    }
}
