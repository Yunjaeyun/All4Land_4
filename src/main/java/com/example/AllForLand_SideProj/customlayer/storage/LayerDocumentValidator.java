package com.example.AllForLand_SideProj.customlayer.storage;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.*;

/** Shared validation for persistence and read-only spatial analysis. */
public final class LayerDocumentValidator {
    private LayerDocumentValidator() {}
    public static LayerDocument validate(LayerDocument layerDocument) {
        check(layerDocument != null && layerDocument.features() != null && layerDocument.features().size() <= 1000, "장소·도형은 최대 1,000개까지 저장할 수 있습니다.");
        var layers = layerDocument.features();
        Set<Long> ids = new HashSet<>();
        long photoBytes = 0;
        for (var layer : layers) {
            check(layer != null && layer.id() > 0 && ids.add(layer.id()), "항목 ID가 잘못되었거나 중복됩니다.");
            check(layer.name() != null && !layer.name().isBlank() && layer.name().length() <= 100, "이름은 1~100자여야 합니다.");
            check(layer.month() >= 1 && layer.month() <= 12 && validTime(layer.time()), "월·시간이 올바르지 않습니다.");
            validateShape(layer.shape());
            if (layer.photo() != null) {
                check(layer.photo().length() <= 7_000_000 && layer.photo().matches("(?s)^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$"), "사진 형식이나 크기가 올바르지 않습니다.");
                photoBytes += layer.photo().length();
            }
        }
        check(photoBytes <= 20_000_000, "사진 총 용량이 너무 큽니다. 사진을 줄여주세요.");
        var snapshot = new LayerDocument(layers.stream().map(layer -> {
            var shape = layer.shape();
            return new Feature(layer.id(), layer.name().trim(), layer.month(), layer.time(), layer.visible(), layer.photo(),
                new Shape(shape.type(), shape.color(), shape.path() == null ? null : List.copyOf(shape.path()), shape.position(), shape.bounds(), shape.radius()));
        }).toList());
        return snapshot;
    }

    private static void validateShape(Shape shape) {
        check(shape != null && shape.type() != null && shape.color() != null && shape.color().matches("#[0-9a-fA-F]{6}"), "도형 종류·색상이 올바르지 않습니다.");
        switch (shape.type()) {
            case "marker" -> point(shape.position());
            case "circle" -> {
                point(shape.position());
                check(shape.radius() != null && Double.isFinite(shape.radius()) && shape.radius() > 0 && shape.radius() <= 20_000_000, "원 반지름이 올바르지 않습니다.");
            }
            case "polyline", "polygon" -> {
                check(shape.path() != null && shape.path().size() >= (shape.type().equals("polygon") ? 3 : 2)
                    && shape.path().size() <= 10_000, "도형 꼭짓점 수가 올바르지 않습니다.");
                shape.path().forEach(LayerDocumentValidator::point);
            }
            case "rectangle" -> {
                var bounds = shape.bounds();
                check(bounds != null, "사각형 좌표가 필요합니다.");
                point(new Point(bounds.north(), bounds.east())); point(new Point(bounds.south(), bounds.west()));
                check(bounds.north() > bounds.south() && bounds.east() > bounds.west(), "사각형 범위가 올바르지 않습니다.");
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 도형입니다.");
        }
    }
    private static void point(Point point) {
        check(point != null && point.lat() != null && point.lng() != null && Double.isFinite(point.lat()) && Double.isFinite(point.lng())
            && point.lat() >= -90 && point.lat() <= 90 && point.lng() >= -180 && point.lng() <= 180, "좌표 범위가 올바르지 않습니다.");
    }
    private static boolean validTime(String time) { return time != null && time.matches("([01]\\d|2[0-3]):[0-5]\\d"); }
    private static void check(boolean valid, String message) { if (!valid) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
