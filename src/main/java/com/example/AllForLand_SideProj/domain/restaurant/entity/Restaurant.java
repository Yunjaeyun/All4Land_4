package com.example.AllForLand_SideProj.domain.restaurant.entity;

import com.example.AllForLand_SideProj.global.entity.BaseEntity;
import com.example.AllForLand_SideProj.domain.safetyzone.entity.SafetyZone;
import com.example.AllForLand_SideProj.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "restaurants")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Restaurant extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "restaurant_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "safety_zone_id", nullable = false)
    private SafetyZone safetyZone;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "longitude", nullable = false, precision = 11, scale = 8)
    private BigDecimal longitude;

    @Column(name = "latitude", nullable = false, precision = 10, scale = 8)
    private BigDecimal latitude;

    @Column(name = "address", nullable = false, length = 255)
    private String address;

    @Column(name = "cuisine_type", length = 50)
    private String cuisineType;

    @Column(name = "rating", precision = 3, scale = 2)
    private BigDecimal rating;
}