package com.example.AllForLand_SideProj.domain.safetyzone;


import com.example.AllForLand_SideProj.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Polygon;

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

    @Column(name = "geometry", nullable = false, columnDefinition = "geometry(Polygon,4326)")
    private Polygon geometry;

    @Column(name = "population", nullable = false)
    private Integer population;

    @Column(name = "crime_count", nullable = false)
    private Integer crimeCount;

    @Column(name = "crime_rate", nullable = false, precision = 6, scale = 2)
    private BigDecimal crimeRate;

    @Column(name = "safety_level", nullable = false)
    private Integer safetyLevel;
}