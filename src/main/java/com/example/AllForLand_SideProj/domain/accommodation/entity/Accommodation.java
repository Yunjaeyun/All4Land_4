package com.example.AllForLand_SideProj.domain.accommodation.entity;


import com.example.AllForLand_SideProj.domain.accommodation.enums.RoomType;
import com.example.AllForLand_SideProj.global.entity.BaseEntity;
import com.example.AllForLand_SideProj.domain.safetyzone.entity.SafetyZone;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "accommodations")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Accommodation extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "accommodation_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "safety_zone_id")
    private SafetyZone safetyZone;

    @Column(name = "name", length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_type", nullable = false, length = 30)
    private RoomType roomType;

    @Column(name = "price_total", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceTotal;

    @Column(name = "latitude", nullable = false, precision = 10, scale = 8)
    private BigDecimal latitude;

    @Column(name = "longitude", nullable = false, precision = 11, scale = 8)
    private BigDecimal longitude;

    @Column(name = "max_guests", nullable = false)
    private Integer maxGuests;

    @Column(name = "bedrooms", nullable = false)
    private Integer bedrooms;

    @Column(name = "cleanliness_score", precision = 4, scale = 1)
    private BigDecimal cleanlinessScore;

    @Column(name = "satisfaction_score", precision = 5, scale = 1)
    private BigDecimal satisfactionScore;

    @Column(name = "is_superhost", nullable = false)
    private Boolean isSuperhost;

    @Column(name = "distance_city_center_km", precision = 6, scale = 2)
    private BigDecimal distanceCityCenterKm;

    @Column(name = "distance_metro_km", precision = 6, scale = 2)
    private BigDecimal distanceMetroKm;

    @Column(name = "day_type", length = 10)
    private String dayType;
}