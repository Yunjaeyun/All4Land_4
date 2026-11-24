package com.example.AllForLand_SideProj.domain.accommodation.repository;

import com.example.AllForLand_SideProj.domain.accommodation.entity.AccommodationFavorite;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AccommodationFavoriteRepository extends JpaRepository<AccommodationFavorite, Long> {

    @EntityGraph(attributePaths = {"accommodation", "accommodation.safetyZone"})
    List<AccommodationFavorite> findAllByUserLoginIdOrderByIdDesc(String loginId);

    Optional<AccommodationFavorite> findByUserLoginIdAndAccommodationId(String loginId, Long accommodationId);

    @Query("select f.accommodation.id from AccommodationFavorite f "
            + "where f.user.loginId = :loginId and f.accommodation.id in :ids")
    List<Long> findFavoritedIds(@Param("loginId") String loginId, @Param("ids") Collection<Long> ids);
}