package com.example.AllForLand_SideProj.customlayer.storage;

import java.util.List;

/** Transport format independent of JPA and Google Maps overlays. Coordinates use WGS84. */
public record LayerDocument(List<Feature> features) {
    public record Feature(long id, String name, int month, String time, boolean visible, String photo, Shape shape) {}
    public record Point(Double lat, Double lng) {}
    public record Bounds(Double north, Double south, Double east, Double west) {}
    public record Shape(String type, String color, List<Point> path, Point position,
                        Bounds bounds, Double radius) {}
}
