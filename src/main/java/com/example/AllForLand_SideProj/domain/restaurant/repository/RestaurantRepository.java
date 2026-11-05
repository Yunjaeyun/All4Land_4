package com.example.AllForLand_SideProj.domain.restaurant.repository;

import com.example.AllForLand_SideProj.domain.restaurant.entity.Restaurant;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {

    @EntityGraph(attributePaths = "safetyZone")
    List<Restaurant> findAllByOrderByIdDesc();
}
