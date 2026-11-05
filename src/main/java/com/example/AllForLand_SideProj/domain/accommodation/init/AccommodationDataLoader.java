package com.example.AllForLand_SideProj.domain.accommodation.init;

import com.example.AllForLand_SideProj.domain.accommodation.enums.RoomType;
import com.example.AllForLand_SideProj.domain.accommodation.repository.AccommodationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
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
 * accommodations가 비어 있으면 Kaggle Airbnb 런던 데이터로 채운다.
 * 원본에 숙소 이름이 없어서 "LSOA 자치구 · 방 유형 · 침실 수"로 검색용 이름을 만들어 저장한다.
 */
@Slf4j
@Component
@Profile("!map-only")
@Order(2)
@RequiredArgsConstructor
public class AccommodationDataLoader implements ApplicationRunner {

    private static final String SOURCE = "data/london-airbnb-listings.json";
    // 좌표가 속한 LSOA를 같은 문장에서 찾아 연결한다. 구역 밖이면 safety_zone_id는 NULL
    private static final String INSERT_SQL = """
            INSERT INTO accommodations
                (safety_zone_id, room_type, price_total, latitude, longitude, max_guests, bedrooms,
                 cleanliness_score, satisfaction_score, is_superhost, distance_city_center_km, distance_metro_km,
                 day_type, created_at, updated_at)
            VALUES (
                (SELECT safety_zone_id FROM safety_zones
                 WHERE ST_Covers(geometry, ST_SetSRID(ST_MakePoint(?, ?), 4326)) LIMIT 1),
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now())
            """;
    // 자치구는 LSOA 이름 "Camden 016C"에서 끝의 코드를 뗀 값. 구역 밖이면 "London"
    private static final String NAME_SQL = """
            UPDATE accommodations a
            SET name = COALESCE((SELECT regexp_replace(z.lsoa_name, '\\s+\\S+$', '')
                                 FROM safety_zones z WHERE z.safety_zone_id = a.safety_zone_id), 'London')
                       || ' · ' || CASE a.room_type
                                       WHEN 'ENTIRE_HOME' THEN '전체 집'
                                       WHEN 'PRIVATE_ROOM' THEN '개인실'
                                       ELSE '공용실' END
                       || CASE WHEN a.bedrooms > 0 THEN ' · 침실 ' || a.bedrooms || '개' ELSE ' · 스튜디오' END
            WHERE a.name IS NULL
            """;

    private final AccommodationRepository accommodationRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_accommodations_price ON accommodations (price_total)");
        if (accommodationRepository.count() > 0) return;

        JsonNode listings;
        try (InputStream in = new ClassPathResource(SOURCE).getInputStream()) {
            listings = objectMapper.readTree(in).path("listings");
        }

        List<Object[]> rows = new ArrayList<>();
        for (JsonNode l : listings) {
            RoomType roomType = toRoomType(l.path("roomType").asString());
            rows.add(new Object[]{
                    l.path("longitude").asDouble(),
                    l.path("latitude").asDouble(),
                    roomType.name(),
                    l.path("priceTotal").decimalValue(),
                    l.path("latitude").decimalValue(),
                    l.path("longitude").decimalValue(),
                    l.path("maxGuests").asInt(),
                    l.path("bedrooms").asInt(),
                    l.path("cleanlinessScore").decimalValue(),
                    l.path("satisfactionScore").decimalValue(),
                    l.path("isSuperhost").asBoolean(),
                    l.path("distanceCityCenter").decimalValue(),
                    l.path("distanceMetro").decimalValue(),
                    l.path("dayType").asString()
            });
        }
        jdbcTemplate.batchUpdate(INSERT_SQL, rows);

        jdbcTemplate.update(NAME_SQL);
        log.info("accommodations {}건 적재 완료", rows.size());
    }

    private RoomType toRoomType(String source) {
        return switch (source) {
            case "Entire home/apt" -> RoomType.ENTIRE_HOME;
            case "Shared room" -> RoomType.SHARED_ROOM;
            default -> RoomType.PRIVATE_ROOM;
        };
    }
}
