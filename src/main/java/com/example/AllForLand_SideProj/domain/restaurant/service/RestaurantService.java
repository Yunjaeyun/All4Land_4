package com.example.AllForLand_SideProj.domain.restaurant.service;

import com.example.AllForLand_SideProj.domain.restaurant.dto.RestaurantCreateRequest;
import com.example.AllForLand_SideProj.domain.restaurant.dto.RestaurantResponse;
import com.example.AllForLand_SideProj.domain.restaurant.entity.Restaurant;
import com.example.AllForLand_SideProj.domain.restaurant.repository.RestaurantRepository;
import com.example.AllForLand_SideProj.domain.safetyzone.entity.SafetyZone;
import com.example.AllForLand_SideProj.domain.safetyzone.repository.SafetyZoneRepository;
import com.example.AllForLand_SideProj.domain.user.entity.User;
import com.example.AllForLand_SideProj.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
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
    private final UserRepository userRepository;

    public List<RestaurantResponse> findAll(String loginId, boolean mineOnly) {
        List<Restaurant> restaurants = mineOnly
                ? restaurantRepository.findAllByUserLoginIdOrderByIdDesc(loginId)
                : restaurantRepository.findAllByOrderByIdDesc();
        return restaurants.stream()
                .map(restaurant -> RestaurantResponse.from(restaurant, loginId))
                .toList();
    }

    @Transactional
    public RestaurantResponse create(RestaurantCreateRequest request, String loginId) {
        User user = userRepository.findByLoginId(loginId)
                .orElseThrow(() -> new NoSuchElementException("로그인 정보를 찾을 수 없습니다."));

        BigDecimal latitude = request.latitude().setScale(8, RoundingMode.HALF_UP);
        BigDecimal longitude = request.longitude().setScale(8, RoundingMode.HALF_UP);

        SafetyZone safetyZone = safetyZoneRepository.findCovering(longitude.doubleValue(), latitude.doubleValue())
                .orElseThrow(() -> new IllegalArgumentException("런던 LSOA 구역 밖의 위치는 등록할 수 없습니다."));

        Restaurant restaurant = Restaurant.builder()
                .safetyZone(safetyZone)
                .user(user)
                .name(request.name().strip())
                .address(request.address().strip())
                .latitude(latitude)
                .longitude(longitude)
                .cuisineType(request.cuisineType() == null || request.cuisineType().isBlank() ? null : request.cuisineType().strip())
                .rating(request.rating() == null ? null : request.rating().setScale(2, RoundingMode.HALF_UP))
                .build();

        return RestaurantResponse.from(restaurantRepository.save(restaurant), loginId);
    }

    @Transactional
    public void delete(Long id, String loginId) {
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("이미 삭제되었거나 존재하지 않는 맛집입니다."));
        if (!restaurant.isOwnedBy(loginId)) {
            throw new AccessDeniedException("본인이 등록한 맛집만 삭제할 수 있어요.");
        }
        restaurantRepository.delete(restaurant);
    }
}