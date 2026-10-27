package com.example.AllForLand_SideProj.domain.accommodation.repository;

import com.example.AllForLand_SideProj.domain.accommodation.entity.Accommodation;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.domain.Specification;

public interface AccommodationRepository extends JpaRepository<Accommodation, Long>, JpaSpecificationExecutor<Accommodation> {

    @Override
    @EntityGraph(attributePaths = "safetyZone")
    Page<Accommodation> findAll(Specification<Accommodation> spec, Pageable pageable);
    

    @Query("select distinct z.lsoaName from SafetyZone z where exists (select a.id from Accommodation a where a.safetyZone = z)")
    List<String> findAllLsoaNames();

    @Query(value = """
            SELECT regexp_replace(z.lsoa_name, '\\s+\\S+$', '') AS borough, COUNT(*) AS cnt
            FROM (
                SELECT DISTINCT safety_zone_id, latitude, longitude, room_type, max_guests, bedrooms
                FROM accommodations
            ) AS d
            JOIN safety_zones z ON z.safety_zone_id = d.safety_zone_id
            GROUP BY 1
            """, nativeQuery = true)
    List<Object[]> countUniqueByBorough();
}
