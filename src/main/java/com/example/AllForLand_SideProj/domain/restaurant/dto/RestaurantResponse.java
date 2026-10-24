package com.example.AllForLand_SideProj.domain.restaurant.dto;

import com.example.AllForLand_SideProj.domain.restaurant.entity.Restaurant;
import com.example.AllForLand_SideProj.domain.safetyzone.entity.SafetyZone;

import java.math.BigDecimal;

public record RestaurantResponse(
        Long id,
        String name,
        String address,
        String cuisineType,
        BigDecimal rating,
        BigDecimal latitude,
        BigDecimal longitude,
        String lsoaName,
        Integer safetyLevel
) {
    public static RestaurantResponse from(Restaurant restaurant) {
        SafetyZone zone = restaurant.getSafetyZone();
        return new RestaurantResponse(
                restaurant.getId(),
                restaurant.getName(),
                restaurant.getAddress(),
                restaurant.getCuisineType(),
                restaurant.getRating(),
                restaurant.getLatitude(),
                restaurant.getLongitude(),
                zone.getLsoaName(),
                zone.getSafetyLevel()
        );
    }
}
