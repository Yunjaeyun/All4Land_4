package com.example.AllForLand_SideProj.global.init;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * ddl-auto: update가 반영하지 않는 기존 컬럼 변경(타입, NOT NULL 해제)을 맞춘다.
 * 이미 맞춰진 DB에서는 아무것도 하지 않으며, 데이터 적재 Runner보다 먼저 실행된다.
 */
@Slf4j
@Component
@Profile("!map-only")
@Order(0)
@RequiredArgsConstructor
public class SchemaPatchRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 2026-10-24: LSOA 4건이 MultiPolygon이라 Polygon → MultiPolygon
        if ("POLYGON".equals(geometryType("safety_zones", "geometry"))) {
            jdbcTemplate.execute("""
                    ALTER TABLE safety_zones
                    ALTER COLUMN geometry TYPE geometry(MultiPolygon, 4326) USING ST_Multi(geometry)
                    """);
            log.info("스키마 보정: safety_zones.geometry → MultiPolygon");
        }

        // 2026-10-24: 로그인 기능 전까지 맛집 등록자 없이 저장
        if (isNotNull("restaurants", "user_id")) {
            jdbcTemplate.execute("ALTER TABLE restaurants ALTER COLUMN user_id DROP NOT NULL");
            log.info("스키마 보정: restaurants.user_id → nullable");
        }
    }

    private String geometryType(String table, String column) {
        return jdbcTemplate.query("""
                        SELECT type FROM geometry_columns
                        WHERE f_table_schema = current_schema() AND f_table_name = ? AND f_geometry_column = ?
                        """,
                (rs, rowNum) -> rs.getString("type"), table, column)
                .stream().findFirst().orElse(null);
    }

    private boolean isNotNull(String table, String column) {
        return jdbcTemplate.query("""
                        SELECT is_nullable FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?
                        """,
                (rs, rowNum) -> rs.getString("is_nullable"), table, column)
                .stream().findFirst().map("NO"::equals).orElse(false);
    }
}
