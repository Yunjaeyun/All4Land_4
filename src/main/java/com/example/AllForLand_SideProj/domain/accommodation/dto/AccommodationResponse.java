package com.example.AllForLand_SideProj.domain.accommodation.dto;

import com.example.AllForLand_SideProj.domain.accommodation.entity.Accommodation;
import com.example.AllForLand_SideProj.domain.accommodation.enums.RoomType;
import com.example.AllForLand_SideProj.domain.safetyzone.entity.SafetyZone;

import java.math.BigDecimal;

public record AccommodationResponse(
        Long id,
        String name,
        RoomType roomType,
        BigDecimal priceTotal,
        BigDecimal latitude,
        BigDecimal longitude,
        Integer maxGuests,
        Integer bedrooms,
        BigDecimal cleanlinessScore,
        BigDecimal satisfactionScore,
        Boolean isSuperhost,
        BigDecimal distanceCityCenterKm,
        BigDecimal distanceMetroKm,
        String dayType,
        String lsoaName,
        Integer safetyLevel
) {
    public static AccommodationResponse from(Accommodation a) {
        SafetyZone zone = a.getSafetyZone();
        return new AccommodationResponse(
                a.getId(), a.getName(), a.getRoomType(), a.getPriceTotal(),
                a.getLatitude(), a.getLongitude(), a.getMaxGuests(), a.getBedrooms(),
                a.getCleanlinessScore(), a.getSatisfactionScore(), a.getIsSuperhost(),
                a.getDistanceCityCenterKm(), a.getDistanceMetroKm(), a.getDayType(),
                zone == null ? null : zone.getLsoaName(),
                zone == null ? null : zone.getSafetyLevel()
        );
    }
}
