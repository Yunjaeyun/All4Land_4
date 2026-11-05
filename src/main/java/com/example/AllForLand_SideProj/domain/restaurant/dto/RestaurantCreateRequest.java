package com.example.AllForLand_SideProj.domain.restaurant.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record RestaurantCreateRequest(
        @NotBlank(message = "상호명을 입력해 주세요.")
        @Size(max = 150, message = "상호명은 150자 이하로 입력해 주세요.")
        String name,

        @NotBlank(message = "주소를 입력해 주세요.")
        @Size(max = 255, message = "주소는 255자 이하로 입력해 주세요.")
        String address,

        @NotNull(message = "위도가 필요합니다.")
        @DecimalMin("-90") @DecimalMax("90")
        BigDecimal latitude,

        @NotNull(message = "경도가 필요합니다.")
        @DecimalMin("-180") @DecimalMax("180")
        BigDecimal longitude,

        @Size(max = 50, message = "음식 종류는 50자 이하로 입력해 주세요.")
        String cuisineType,

        @DecimalMin(value = "0.0", message = "평점은 0~5 사이로 입력해 주세요.")
        @DecimalMax(value = "5.0", message = "평점은 0~5 사이로 입력해 주세요.")
        BigDecimal rating
) {
}
