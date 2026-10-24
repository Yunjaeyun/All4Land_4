package com.example.AllForLand_SideProj.domain.safetyzone.init;

import com.example.AllForLand_SideProj.domain.safetyzone.repository.SafetyZoneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * safety_zones가 비어 있으면 주제도 GeoJSON(LSOA 경계 + 치안 지표)으로 채운다.
 */
@Slf4j
@Component
@Profile("!map-only")
@RequiredArgsConstructor
public class SafetyZoneDataLoader implements ApplicationRunner {

    private static final String SOURCE = "static/data/london-lsoa-themes.json";
    private static final String INSERT_SQL = """
            INSERT INTO safety_zones
                (lsoa_code, lsoa_name, geometry, population, crime_count, crime_rate, safety_level, created_at, updated_at)
            VALUES (?, ?, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)), ?, ?, ?, ?, now(), now())
            """;

    private final SafetyZoneRepository safetyZoneRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_safety_zones_geometry ON safety_zones USING GIST (geometry)");
        if (safetyZoneRepository.count() > 0) return;

        JsonNode features;
        try (InputStream in = new ClassPathResource(SOURCE).getInputStream()) {
            features = objectMapper.readTree(in).path("features");
        }

        List<Object[]> rows = new ArrayList<>();
        for (JsonNode feature : features) {
            JsonNode p = feature.path("properties");
            rows.add(new Object[]{
                    p.path("code").asString(),
                    p.path("name").asString(),
                    feature.path("geometry").toString(),
                    p.path("population").asInt(),
                    p.path("crimeCount").asInt(),
                    p.path("safetyIncidentRate").decimalValue(),
                    p.path("safetyLevel").asInt()
            });
        }
        jdbcTemplate.batchUpdate(INSERT_SQL, rows);
        log.info("safety_zones {}건 적재 완료", rows.size());
    }
}
