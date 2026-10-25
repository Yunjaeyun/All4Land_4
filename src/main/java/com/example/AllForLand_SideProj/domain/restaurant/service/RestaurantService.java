package com.example.AllForLand_SideProj.domain.restaurant.service;

import com.example.AllForLand_SideProj.domain.restaurant.dto.RestaurantCreateRequest;
import com.example.AllForLand_SideProj.domain.restaurant.dto.RestaurantResponse;
import com.example.AllForLand_SideProj.domain.restaurant.entity.Restaurant;
import com.example.AllForLand_SideProj.domain.restaurant.repository.RestaurantRepository;
import com.example.AllForLand_SideProj.domain.safetyzone.entity.SafetyZone;
import com.example.AllForLand_SideProj.domain.safetyzone.repository.SafetyZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.NoSuchElementException;

@Service
@Profile("!map-only")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final SafetyZoneRepository safetyZoneRepository;

    public List<RestaurantResponse> findAll() {
        return restaurantRepository.findAllByOrderByIdDesc().stream()
                .map(RestaurantResponse::from)
                .toList();
    }

    @Transactional
    public RestaurantResponse create(RestaurantCreateRequest request) {
        // 컬럼 scale(8)에 맞춰 반올림해 저장값과 응답값을 일치시킨다
        BigDecimal latitude = request.latitude().setScale(8, RoundingMode.HALF_UP);
        BigDecimal longitude = request.longitude().setScale(8, RoundingMode.HALF_UP);

        SafetyZone safetyZone = safetyZoneRepository.findCovering(longitude.doubleValue(), latitude.doubleValue())
                .orElseThrow(() -> new IllegalArgumentException("런던 LSOA 구역 밖의 위치는 등록할 수 없습니다."));

        Restaurant restaurant = Restaurant.builder()
                .safetyZone(safetyZone)
                .name(request.name().strip())
                .address(request.address().strip())
                .latitude(latitude)
                .longitude(longitude)
                .cuisineType(request.cuisineType() == null || request.cuisineType().isBlank() ? null : request.cuisineType().strip())
                .rating(request.rating() == null ? null : request.rating().setScale(2, RoundingMode.HALF_UP))
                .build();

        return RestaurantResponse.from(restaurantRepository.save(restaurant));
    }

    @Transactional
    public void delete(Long id) {
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("이미 삭제되었거나 존재하지 않는 맛집입니다."));
        restaurantRepository.delete(restaurant);
    }
}
