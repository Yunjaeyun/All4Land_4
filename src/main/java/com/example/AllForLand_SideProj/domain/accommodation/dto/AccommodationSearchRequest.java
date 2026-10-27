package com.example.AllForLand_SideProj.domain.accommodation.dto;

import com.example.AllForLand_SideProj.domain.accommodation.enums.RoomType;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;

/** 모든 조건은 선택이며, 주어진 조건만 AND로 적용한다. */
public record AccommodationSearchRequest(
        @Size(max = 100, message = "검색어는 100자 이하로 입력해 주세요.")
        String keyword,

        RoomType roomType,

        @DecimalMin(value = "0", message = "최소 가격은 0 이상이어야 합니다.")
        BigDecimal minPrice,

        @DecimalMin(value = "0", message = "최대 가격은 0 이상이어야 합니다.")
        BigDecimal maxPrice,

        @Min(value = 1, message = "인원은 1명 이상이어야 합니다.")
        @Max(value = 20, message = "인원은 20명 이하로 입력해 주세요.")
        Integer guests,

        @Min(value = 0, message = "침실 수는 0 이상이어야 합니다.")
        @Max(value = 20, message = "침실 수는 20 이하로 입력해 주세요.")
        Integer minBedrooms,

        Boolean superhostOnly,

        // 치안 등급 상한 (1=매우 안전 … 5=위험). 값이 3이면 1~3등급 구역만 찾는다
        @Min(value = 1, message = "치안 등급은 1~5 사이로 입력해 주세요.")
        @Max(value = 5, message = "치안 등급은 1~5 사이로 입력해 주세요.")
        Integer maxSafetyLevel,

        @DecimalMin(value = "0", message = "만족도는 0~100 사이로 입력해 주세요.")
        @DecimalMax(value = "100", message = "만족도는 0~100 사이로 입력해 주세요.")
        BigDecimal minSatisfaction,

        AccommodationSort sort,

        @Min(value = 0, message = "페이지는 0 이상이어야 합니다.")
        Integer page,

        @Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
        @Max(value = 100, message = "페이지 크기는 100 이하로 입력해 주세요.")
        Integer size,
        
        Boolean safestTop,

        @Min(value = 1, message = "상위 개수는 1~50 사이로 입력해 주세요.")
        @Max(value = 50, message = "상위 개수는 1~50 사이로 입력해 주세요.")
        Integer topN
        
        
) {
}
