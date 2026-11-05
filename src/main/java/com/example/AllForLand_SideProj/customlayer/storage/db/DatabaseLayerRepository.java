package com.example.AllForLand_SideProj.customlayer.storage.db;

import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument;
import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.Feature;
import com.example.AllForLand_SideProj.customlayer.storage.LayerRepository;
import java.sql.Time;
import java.time.LocalTime;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** One personal layer per user; metadata belongs to individual features. */
@Repository
@Profile("layer-db")
public class DatabaseLayerRepository implements LayerRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final LayerGeometryMapper geometry = new LayerGeometryMapper();
    public DatabaseLayerRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public LayerDocument findAll(String workspace) {
        var features = jdbc.query("""
            SELECT f.client_feature_id, f.title, f.visit_month, f.visit_time, f.is_visible, f.photo_data,
                f.shape_type, f.color, ST_AsText(f.geometry) AS wkt, f.radius_m
            FROM user_custom_layers l JOIN custom_layer_features f ON f.custom_layer_id = l.custom_layer_id
            WHERE l.user_id = :owner AND l.is_personal = TRUE ORDER BY f.display_order
            """, Map.of("owner", Long.parseLong(workspace)), (row, index) -> new Feature(
                row.getLong("client_feature_id"), row.getString("title"), row.getInt("visit_month"),
                row.getTime("visit_time").toLocalTime().toString(), row.getBoolean("is_visible"), row.getString("photo_data"),
                geometry.fromWkt(row.getString("shape_type"), row.getString("color"), row.getString("wkt"), row.getObject("radius_m", Double.class))));
        return new LayerDocument(features);
    }

    @Transactional
    public void replaceAll(String workspace, LayerDocument document) {
        long owner = Long.parseLong(workspace);
        jdbc.queryForObject("SELECT user_id FROM users WHERE user_id = :owner FOR UPDATE", Map.of("owner", owner), Long.class);
        Long layer = jdbc.queryForObject("""
            INSERT INTO user_custom_layers (user_id, layer_name, is_public, is_personal, created_at, updated_at)
            VALUES (:owner, '나만의 장소 지도', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) WHERE is_personal = TRUE DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            RETURNING custom_layer_id
            """, Map.of("owner", owner), Long.class);
        jdbc.update("DELETE FROM custom_layer_features WHERE custom_layer_id = :layer", Map.of("layer", layer));
        int order = 0;
        for (var item : document.features()) {
            var shape = item.shape();
            var params = new MapSqlParameterSource().addValue("layer", layer).addValue("client", item.id())
                .addValue("title", item.name()).addValue("month", item.month()).addValue("time", Time.valueOf(LocalTime.parse(item.time())))
                .addValue("visible", item.visible()).addValue("photo", item.photo()).addValue("type", shape.type())
                .addValue("color", shape.color()).addValue("wkt", geometry.toWkt(shape)).addValue("radius", shape.radius()).addValue("order", order++);
            jdbc.update("""
                INSERT INTO custom_layer_features (custom_layer_id, client_feature_id, title, visit_month, visit_time,
                    is_visible, photo_data, shape_type, color, geometry, radius_m, display_order, created_at, updated_at)
                VALUES (:layer, :client, :title, :month, :time, :visible, :photo, :type, :color,
                    ST_GeomFromText(:wkt, 4326), :radius, :order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, params);
        }
    }
    /** Session expiry never removes a user's personal layer. */
    public void deleteWorkspace(String workspace) { }
}
