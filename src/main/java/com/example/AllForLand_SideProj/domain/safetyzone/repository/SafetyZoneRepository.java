package com.example.AllForLand_SideProj.domain.safetyzone.repository;

import com.example.AllForLand_SideProj.domain.safetyzone.entity.SafetyZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SafetyZoneRepository extends JpaRepository<SafetyZone, Long> {

    // 좌표가 속한 LSOA 구역 (경계선 위의 점도 포함)
    @Query(value = """
            SELECT * FROM safety_zones
            WHERE ST_Covers(geometry, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326))
            LIMIT 1
            """, nativeQuery = true)
    Optional<SafetyZone> findCovering(@Param("longitude") double longitude, @Param("latitude") double latitude);
}
