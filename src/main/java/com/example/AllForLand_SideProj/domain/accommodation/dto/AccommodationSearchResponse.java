package com.example.AllForLand_SideProj.domain.accommodation.dto;

import java.util.List;

public record AccommodationSearchResponse(
        long total,
        int page,
        int size,
        boolean hasNext,
        List<AccommodationResponse> items
) {
}
