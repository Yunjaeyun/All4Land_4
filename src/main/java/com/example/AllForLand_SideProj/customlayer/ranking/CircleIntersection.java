package com.example.AllForLand_SideProj.customlayer.ranking;

import org.locationtech.jts.geom.*;
import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Shape;

/** Spherical distance to every ring segment, including holes; circles are never reduced to their centre. */
final class CircleIntersection {
    // Same spherical Earth radius as draw.js.
    private static final double EARTH = 6371008.8;
    private static final double TOLERANCE = 0.01; // metres, numerical boundary contact tolerance
    private CircleIntersection() {}

    static Envelope envelope(Shape shape) {
        double latitude = shape.position().lat(), longitude = shape.position().lng();
        double angle = (shape.radius() + TOLERANCE) / EARTH;
        double deltaLat = Math.toDegrees(angle);
        double south = Math.max(-90, latitude - deltaLat), north = Math.min(90, latitude + deltaLat);
        if (south <= -90 || north >= 90 || angle >= Math.PI / 2) return new Envelope(-180, 180, south, north);
        double deltaLng = Math.toDegrees(Math.asin(Math.min(1, Math.sin(angle) / Math.cos(Math.toRadians(latitude)))));
        if (longitude - deltaLng < -180 || longitude + deltaLng > 180) return new Envelope(-180, 180, south, north);
        return new Envelope(longitude - deltaLng, longitude + deltaLng, south, north);
    }

    static boolean intersects(Shape shape, RegionCatalog.Area area, Geometry centre) {
        if (area.prepared().covers(centre)) return true;
        Coordinate point = centre.getCoordinate();
        Geometry boundary = area.geometry().getBoundary();
        for (int ring = 0; ring < boundary.getNumGeometries(); ring++) {
            Coordinate[] coordinates = boundary.getGeometryN(ring).getCoordinates();
            for (int i = 1; i < coordinates.length; i++)
                if (segmentDistance(point, coordinates[i - 1], coordinates[i]) <= shape.radius() + TOLERANCE) return true;
        }
        return false;
    }

    private static double segmentDistance(Coordinate p, Coordinate a, Coordinate b) {
        double length = angle(a, b), distance = angle(a, p);
        if (length < 1e-15) return distance * EARTH;
        double difference = bearing(a, p) - bearing(a, b);
        double along = Math.atan2(Math.sin(distance) * Math.cos(difference), Math.cos(distance));
        if (along < 0 || along > length) return Math.min(distance, angle(b, p)) * EARTH;
        double cross = Math.asin(Math.max(-1, Math.min(1, Math.sin(distance) * Math.sin(difference))));
        return Math.abs(cross) * EARTH;
    }
    private static double angle(Coordinate a, Coordinate b) {
        double latitudeA = Math.toRadians(a.y), latitudeB = Math.toRadians(b.y);
        double h = Math.pow(Math.sin((latitudeB - latitudeA) / 2), 2)
            + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.pow(Math.sin(Math.toRadians(b.x - a.x) / 2), 2);
        return 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
    }
    private static double bearing(Coordinate a, Coordinate b) {
        double latitudeA = Math.toRadians(a.y), latitudeB = Math.toRadians(b.y), longitude = Math.toRadians(b.x - a.x);
        return Math.atan2(Math.sin(longitude) * Math.cos(latitudeB),
            Math.cos(latitudeA) * Math.sin(latitudeB) - Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitude));
    }
}
