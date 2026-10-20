package com.example.AllForLand_SideProj.domain.greenspace.entity;

import com.example.AllForLand_SideProj.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Polygon;

import java.math.BigDecimal;


@Entity
@Table(name = "green_spaces")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class GreenSpace extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "green_spaces_id")
    private Long id;

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "geometry", columnDefinition = "geometry(Polygon,4326)")
    private Polygon geometry;

    @Column(name = "area_sqm", precision = 12, scale = 2)
    private BigDecimal areaSqm;

    @Column(name = "type", length = 50)
    private String type;
}