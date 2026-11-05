package com.example.AllForLand_SideProj;

import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument.*;
import com.example.AllForLand_SideProj.customlayer.storage.db.DatabaseLayerWorkspaceResolver;
import com.example.AllForLand_SideProj.customlayer.storage.db.LayerGeometryMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LayerDatabasePreparationTests {
    private final LayerGeometryMapper mapper = new LayerGeometryMapper();
    @Test
    void fiveShapeTypesRoundTripWithLongitudeFirstAndCircleRadiusPreserved() {
        var points = List.of(new Point(51.5, -0.2), new Point(51.6, -0.2), new Point(51.5, -0.1));
        var shapes = List.of(new Shape("marker", "#247b65", null, points.getFirst(), null, null),
            new Shape("circle", "#247b65", null, points.getFirst(), null, 321.0),
            new Shape("polyline", "#247b65", points, null, null, null),
            new Shape("polygon", "#247b65", points, null, null, null),
            new Shape("rectangle", "#247b65", null, null, new Bounds(52.0, 51.0, 1.0, -1.0), null));
        for (var shape : shapes) assertEquals(shape, mapper.fromWkt(shape.type(), shape.color(), mapper.toWkt(shape), shape.radius()));
        assertEquals("POINT (-0.2 51.5)", mapper.toWkt(shapes.getFirst()));
    }
    @Test
    void invalidPolygonIsRejectedBeforeSaving() {
        var bowTie = List.of(new Point(0.0, 0.0), new Point(1.0, 1.0), new Point(0.0, 1.0), new Point(1.0, 0.0));
        assertThrows(ResponseStatusException.class, () -> mapper.toWkt(new Shape("polygon", "#247b65", bowTie, null, null, null)));
    }
    @Test
    void databaseModeRequiresLoginAndIgnoresBrowserSuppliedUserId() {
        var jdbc = mock(JdbcTemplate.class);
        var environment = new MockEnvironment().withProperty("custom-layer.development-user-id", "7");
        var resolver = new DatabaseLayerWorkspaceResolver(jdbc, environment);
        var request = new MockHttpServletRequest();
        request.setParameter("userId", "7");
        assertThrows(ResponseStatusException.class, () -> resolver.resolve(request));
        verifyNoInteractions(jdbc);
        request.setUserPrincipal(() -> "member");
        when(jdbc.queryForList("SELECT user_id FROM users WHERE login_id = ?", Long.class, "member")).thenReturn(List.of(12L));
        assertEquals("12", resolver.resolve(request));
    }
    @Test
    void localDevelopmentUserIsNeverUsedInProduction() {
        var jdbc = mock(JdbcTemplate.class);
        var environment = new MockEnvironment().withProperty("custom-layer.development-user-id", "7");
        environment.setActiveProfiles("layer-db", "layer-db-dev");
        when(jdbc.queryForList("SELECT user_id FROM users WHERE user_id = ?", Long.class, 7L)).thenReturn(List.of(7L));
        var resolver = new DatabaseLayerWorkspaceResolver(jdbc, environment);
        assertEquals("7", resolver.resolve(new MockHttpServletRequest()));
        environment.setActiveProfiles("layer-db", "layer-db-dev", "prod");
        assertThrows(ResponseStatusException.class, () -> resolver.resolve(new MockHttpServletRequest()));
    }
}
