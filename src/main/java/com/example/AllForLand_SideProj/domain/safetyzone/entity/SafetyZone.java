package com.example.AllForLand_SideProj.domain.safetyzone.entity;


import com.example.AllForLand_SideProj.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.MultiPolygon;

import java.math.BigDecimal;

@Entity
@Table(name = "safety_zones")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class SafetyZone extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "safety_zone_id")
    private Long id;

    @Column(name = "lsoa_code", nullable = false, length = 10, unique = true)
    private String lsoaCode;

    @Column(name = "lsoa_name", nullable = false, length = 100)
    private String lsoaName;

    @Column(name = "geometry", nullable = false, columnDefinition = "geometry(MultiPolygon,4326)")
    private MultiPolygon geometry;

    @Column(name = "population", nullable = false)
    private Integer population;

    @Column(name = "crime_count", nullable = false)
    private Integer crimeCount;

    @Column(name = "crime_rate", nullable = false, precision = 6, scale = 2)
    private BigDecimal crimeRate;

    @Column(name = "safety_level", nullable = false)
    private Integer safetyLevel;
}