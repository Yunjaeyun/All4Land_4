package com.example.AllForLand_SideProj.customlayer.ranking;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import org.locationtech.jts.geom.*;
import org.locationtech.jts.geom.prep.PreparedGeometry;
import org.locationtech.jts.geom.prep.PreparedGeometryFactory;
import org.locationtech.jts.geom.util.GeometryFixer;
import org.locationtech.jts.index.strtree.STRtree;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** The SAME LSOA boundaries and borough property used by map.html and SafetyZoneDataLoader. */
@Component
public class RegionCatalog {
    public record Area(String code, String borough, Geometry geometry, PreparedGeometry prepared) {}
    public record Region(String name, Double incidentRate, Integer safetyLevel, double north, double south,
                         double east, double west) {}
    private final STRtree index = new STRtree();
    private final Map<String, Region> regions;
    private final GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);

    @org.springframework.beans.factory.annotation.Autowired
    public RegionCatalog(ObjectMapper mapper) throws IOException {
        this(mapper, new ClassPathResource("static/data/london-lsoa-themes.json").getInputStream());
    }

    // Stream constructor also allows precise synthetic boundary tests.
    public RegionCatalog(ObjectMapper mapper, InputStream input) throws IOException {
        JsonNode root;
        try (input) { root = mapper.readTree(input); }
        record Aggregate(Envelope bounds, double[] totals) {}
        Map<String, Aggregate> aggregates = new LinkedHashMap<>();
        for (JsonNode feature : root.path("features")) {
            var properties = feature.path("properties");
            String borough = properties.path("borough").asString("");
            if (borough.isBlank()) throw new IOException("행정구역 이름이 없는 지도 데이터입니다.");
            Geometry geometry = geometry(feature.path("geometry"));
            if (!geometry.isValid()) geometry = GeometryFixer.fix(geometry);
            if (geometry.isEmpty() || !geometry.isValid()) throw new IOException("행정구역 경계가 올바르지 않습니다.");
            var area = new Area(properties.path("code").asString(), borough, geometry, PreparedGeometryFactory.prepare(geometry));
            index.insert(geometry.getEnvelopeInternal(), area);
            var aggregate = aggregates.computeIfAbsent(borough, ignored -> new Aggregate(new Envelope(), new double[2]));
            aggregate.bounds().expandToInclude(geometry.getEnvelopeInternal());
            // Same numerator/denominator rule as existing map.html buildRanking(safety).
            if (properties.path("crimeCount").isNumber() && properties.path("population").isNumber()) {
                aggregate.totals()[0] += properties.path("crimeCount").asDouble();
                aggregate.totals()[1] += properties.path("population").asDouble();
            }
        }
        if (aggregates.isEmpty()) throw new IOException("행정구역 데이터가 없습니다.");
        index.build();
        var breaks = root.path("metadata").path("indicators").path("safety").path("breaks");
        Map<String, Region> result = new LinkedHashMap<>();
        aggregates.forEach((name, aggregate) -> {
            var bounds = aggregate.bounds();
            Double rate = aggregate.totals()[1] > 0 ? aggregate.totals()[0] * 1000 / aggregate.totals()[1] : null;
            Integer level = null;
            if (rate != null && breaks.isArray() && breaks.size() == 4) {
                level = 1;
                for (var limit : breaks) if (rate > limit.asDouble()) level++;
            }
            result.put(name, new Region(name, rate, level, bounds.getMaxY(), bounds.getMinY(), bounds.getMaxX(), bounds.getMinX()));
        });
        regions = Collections.unmodifiableMap(result);
    }

    @SuppressWarnings("unchecked")
    public List<Area> candidates(Envelope envelope) { return index.query(envelope); }
    public Map<String, Region> regions() { return regions; }

    private Geometry geometry(JsonNode node) throws IOException {
        return switch (node.path("type").asString()) {
            case "Polygon" -> polygon(node.path("coordinates"));
            case "MultiPolygon" -> {
                var polygons = new ArrayList<Polygon>();
                for (var coordinates : node.path("coordinates")) polygons.add(polygon(coordinates));
                yield factory.createMultiPolygon(polygons.toArray(Polygon[]::new));
            }
            default -> throw new IOException("지원하지 않는 행정구역 경계입니다.");
        };
    }
    private Polygon polygon(JsonNode coordinates) {
        LinearRing shell = ring(coordinates.get(0));
        var holes = new LinearRing[coordinates.size() - 1];
        for (int i = 1; i < coordinates.size(); i++) holes[i - 1] = ring(coordinates.get(i));
        return factory.createPolygon(shell, holes);
    }
    private LinearRing ring(JsonNode points) {
        var coordinates = new ArrayList<Coordinate>();
        for (var point : points) coordinates.add(new Coordinate(point.get(0).asDouble(), point.get(1).asDouble()));
        if (!coordinates.getFirst().equals2D(coordinates.getLast())) coordinates.add(new Coordinate(coordinates.getFirst()));
        return factory.createLinearRing(coordinates.toArray(Coordinate[]::new));
    }
}
