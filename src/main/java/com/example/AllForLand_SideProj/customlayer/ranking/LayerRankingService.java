package com.example.AllForLand_SideProj.customlayer.ranking;

import java.util.*;
import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument;
import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Bounds;
import com.example.AllForLand_SideProj.customlayer.storage.LayerDocumentValidator;
import com.example.AllForLand_SideProj.customlayer.storage.db.LayerGeometryMapper;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.ParseException;
import org.locationtech.jts.io.WKTReader;
import org.springframework.stereotype.Service;

@Service
public class LayerRankingService {
    public record Entry(int rank, String borough, int count, Double incidentRate, Integer safetyLevel, Bounds bounds, List<Long> featureIds) {}
    public record Result(int analyzedCount, int matchedCount, int outsideCount, String order, List<Entry> regions) {}
    private final RegionCatalog catalog;
    public LayerRankingService(RegionCatalog catalog) { this.catalog = catalog; }

    public Result rank(LayerDocument request, String order) {
        if (!Set.of("interest", "safety").contains(order)) throw new IllegalArgumentException("순위 정렬 기준이 올바르지 않습니다.");
        var document = LayerDocumentValidator.validate(request);
        Map<String, List<Long>> featuresByRegion = new HashMap<>();
        int analyzed = 0, matched = 0;
        var mapper = new LayerGeometryMapper();
        var reader = new WKTReader();
        for (var feature : document.features()) {
            if (!feature.visible()) continue;
            analyzed++;
            var shape = feature.shape();
            Geometry geometry;
            try { geometry = reader.read(mapper.toWkt(shape)); }
            catch (ParseException error) { throw new IllegalArgumentException("도형 좌표를 확인하세요.", error); }
            boolean circle = shape.type().equals("circle");
            var envelope = circle ? CircleIntersection.envelope(shape) : geometry.getEnvelopeInternal();
            Set<String> hit = new HashSet<>();
            for (var area : catalog.candidates(envelope)) {
                if (hit.contains(area.borough())) continue;
                boolean intersects = circle ? CircleIntersection.intersects(shape, area, geometry) : area.prepared().intersects(geometry);
                if (intersects) hit.add(area.borough());
            }
            if (!hit.isEmpty()) matched++;
            hit.forEach(name -> featuresByRegion.computeIfAbsent(name, key -> new ArrayList<>()).add(feature.id()));
        }
        Comparator<String> byCount = Comparator.comparingInt((String name) -> featuresByRegion.get(name).size()).reversed();
        Comparator<String> bySafety = Comparator.comparing(name -> catalog.regions().get(name).incidentRate(), Comparator.nullsLast(Double::compare));
        Comparator<String> comparator = order.equals("safety") ? bySafety.thenComparing(byCount) : byCount.thenComparing(bySafety);
        var names = featuresByRegion.keySet().stream().sorted(comparator.thenComparing(Comparator.naturalOrder())).toList();
        var entries = new ArrayList<Entry>();
        for (var name : names) {
            var region = catalog.regions().get(name);
            var featureIds = List.copyOf(featuresByRegion.get(name));
            entries.add(new Entry(entries.size() + 1, name, featureIds.size(), region.incidentRate(), region.safetyLevel(),
                new Bounds(region.north(), region.south(), region.east(), region.west()), featureIds));
        }
        return new Result(analyzed, matched, analyzed - matched, order, List.copyOf(entries));
    }
}
