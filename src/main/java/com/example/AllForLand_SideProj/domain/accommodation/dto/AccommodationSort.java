package com.example.AllForLand_SideProj.domain.accommodation.dto;

import org.springframework.data.domain.Sort;

public enum AccommodationSort {
    PRICE_ASC("priceTotal", Sort.Direction.ASC),
    PRICE_DESC("priceTotal", Sort.Direction.DESC),
    SATISFACTION_DESC("satisfactionScore", Sort.Direction.DESC),
    CITY_CENTER_ASC("distanceCityCenterKm", Sort.Direction.ASC),
    METRO_ASC("distanceMetroKm", Sort.Direction.ASC);

    private final String property;
    private final Sort.Direction direction;

    AccommodationSort(String property, Sort.Direction direction) {
        this.property = property;
        this.direction = direction;
    }

    public Sort toSort() {
        // 값이 비어 있는 숙소는 항상 뒤로, 같은 값끼리는 id로 순서를 고정한다
        return Sort.by(new Sort.Order(direction, property).nullsLast(), Sort.Order.asc("id"));
    }
}
