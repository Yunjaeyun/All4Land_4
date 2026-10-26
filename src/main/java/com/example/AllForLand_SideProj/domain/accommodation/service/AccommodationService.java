package com.example.AllForLand_SideProj.domain.accommodation.service;

import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationResponse;
import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSearchRequest;
import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSearchResponse;
import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSort;
import com.example.AllForLand_SideProj.domain.accommodation.entity.Accommodation;
import com.example.AllForLand_SideProj.domain.accommodation.repository.AccommodationRepository;
import com.example.AllForLand_SideProj.domain.safetyzone.entity.SafetyZone;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@Profile("!map-only")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AccommodationService {

    static final int DEFAULT_SIZE = 20;

    private final AccommodationRepository accommodationRepository;

    public AccommodationSearchResponse search(AccommodationSearchRequest request) {
        if (request.minPrice() != null && request.maxPrice() != null
                && request.minPrice().compareTo(request.maxPrice()) > 0) {
            throw new IllegalArgumentException("최소 가격이 최대 가격보다 클 수 없습니다.");
        }

        int page = request.page() == null ? 0 : request.page();
        int size = request.size() == null ? DEFAULT_SIZE : request.size();
        AccommodationSort sort = request.sort() == null ? AccommodationSort.PRICE_ASC : request.sort();

        Page<Accommodation> result = accommodationRepository.findAll(
                toSpecification(request), PageRequest.of(page, size, sort.toSort()));

        List<AccommodationResponse> items = result.getContent().stream().map(AccommodationResponse::from).toList();
        return new AccommodationSearchResponse(result.getTotalElements(), page, size, result.hasNext(), items);
    }

    static Specification<Accommodation> toSpecification(AccommodationSearchRequest request) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            // 치안 등급·구역명 조건에만 필요하지만 LEFT JOIN이라 구역 밖 숙소도 빠지지 않는다
            Join<Accommodation, SafetyZone> zone = root.join("safetyZone", JoinType.LEFT);

            if (request.keyword() != null && !request.keyword().isBlank()) {
                String pattern = "%" + escapeLike(request.keyword().strip().toLowerCase()) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern, '\\'),
                        cb.like(cb.lower(zone.get("lsoaName")), pattern, '\\')));
            }
            if (request.roomType() != null) {
                predicates.add(cb.equal(root.get("roomType"), request.roomType()));
            }
            if (request.minPrice() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("priceTotal"), request.minPrice()));
            }
            if (request.maxPrice() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("priceTotal"), request.maxPrice()));
            }
            if (request.guests() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("maxGuests"), request.guests()));
            }
            if (request.minBedrooms() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("bedrooms"), request.minBedrooms()));
            }
            if (Boolean.TRUE.equals(request.superhostOnly())) {
                predicates.add(cb.isTrue(root.get("isSuperhost")));
            }
            if (request.maxSafetyLevel() != null) {
                predicates.add(cb.lessThanOrEqualTo(zone.get("safetyLevel"), request.maxSafetyLevel()));
            }
            if (request.minSatisfaction() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("satisfactionScore"), request.minSatisfaction()));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
