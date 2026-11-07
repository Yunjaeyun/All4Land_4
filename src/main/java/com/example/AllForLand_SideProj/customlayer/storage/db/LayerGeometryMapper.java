package com.example.AllForLand_SideProj.customlayer.storage.db;

import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.locationtech.jts.geom.*;
import org.locationtech.jts.io.ParseException;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.io.WKTWriter;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class LayerGeometryMapper {
    private final GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);

    public String toWkt(Shape shape) {
        Geometry geometry = switch (shape.type()) {
            case "marker", "circle" -> factory.createPoint(coordinate(shape.position()));
            case "polyline" -> factory.createLineString(shape.path().stream().map(this::coordinate).toArray(Coordinate[]::new));
            case "polygon" -> polygon(shape.path());
            case "rectangle" -> {
                var b = shape.bounds();
                yield polygon(List.of(new com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Point(b.south(), b.west()),
                    new com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Point(b.south(), b.east()),
                    new com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Point(b.north(), b.east()),
                    new com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Point(b.north(), b.west())));
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 도형입니다.");
        };
        if (!geometry.isValid() || geometry.isEmpty() || (geometry instanceof Polygon && geometry.getArea() == 0)
                || (geometry instanceof LineString && geometry.getLength() == 0))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "교차하거나 면적·길이가 없는 도형을 확인하세요.");
        return new WKTWriter().write(geometry);
    }
    private Coordinate coordinate(com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Point point) {
        return new Coordinate(point.lng(), point.lat());
    }
    private Polygon polygon(List<com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Point> points) {
        var coordinates = new ArrayList<>(points.stream().map(this::coordinate).toList());
        if (!coordinates.getFirst().equals2D(coordinates.getLast())) coordinates.add(new Coordinate(coordinates.getFirst()));
        return factory.createPolygon(coordinates.toArray(Coordinate[]::new));
    }
    public Shape fromWkt(String type, String color, String wkt, Double radius) {
        try {
            var geometry = new WKTReader(factory).read(wkt);
            if (type.equals("marker") || type.equals("circle"))
                return new Shape(type, color, null, point(geometry.getCoordinate()), null, radius);
            if (type.equals("rectangle")) {
                var envelope = geometry.getEnvelopeInternal();
                return new Shape(type, color, null, null,
                    new Bounds(envelope.getMaxY(), envelope.getMinY(), envelope.getMaxX(), envelope.getMinX()), null);
            }
            var coordinates = geometry.getCoordinates();
            int size = type.equals("polygon") ? coordinates.length - 1 : coordinates.length;
            return new Shape(type, color, Arrays.stream(coordinates, 0, size).map(this::point).toList(), null, null, null);
        } catch (ParseException error) { throw new IllegalStateException("저장된 도형을 읽을 수 없습니다.", error); }
    }
    private com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Point point(Coordinate point) {
        return new com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Point(point.y, point.x);
    }
}
