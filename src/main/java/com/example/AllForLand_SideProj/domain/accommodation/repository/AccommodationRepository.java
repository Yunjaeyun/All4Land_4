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
    

    @Query("select z.lsoaName from SafetyZone z")
    List<String> findAllLsoaNames();
}
