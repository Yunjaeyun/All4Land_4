package com.example.AllForLand_SideProj.domain.accommodation.service;

import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationResponse;
import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSearchResponse;
import com.example.AllForLand_SideProj.domain.accommodation.entity.Accommodation;
import com.example.AllForLand_SideProj.domain.accommodation.entity.AccommodationFavorite;
import com.example.AllForLand_SideProj.domain.accommodation.repository.AccommodationFavoriteRepository;
import com.example.AllForLand_SideProj.domain.accommodation.repository.AccommodationRepository;
import com.example.AllForLand_SideProj.domain.user.entity.User;
import com.example.AllForLand_SideProj.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
@Profile("!map-only")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AccommodationFavoriteService {

    private final AccommodationFavoriteRepository favoriteRepository;
    private final AccommodationRepository accommodationRepository;
    private final UserRepository userRepository;

    public List<AccommodationResponse> findFavorites(String loginId) {
        return favoriteRepository.findAllByUserLoginIdOrderByIdDesc(loginId).stream()
                .map(favorite -> AccommodationResponse.from(favorite.getAccommodation()).withFavorited(true))
                .toList();
    }

    public AccommodationSearchResponse markFavorited(AccommodationSearchResponse response, String loginId) {
        if (loginId == null || response.items().isEmpty()) {
            return response;
        }
        List<Long> ids = response.items().stream().map(AccommodationResponse::id).toList();
        Set<Long> favorited = new HashSet<>(favoriteRepository.findFavoritedIds(loginId, ids));
        List<AccommodationResponse> items = response.items().stream()
                .map(item -> item.withFavorited(favorited.contains(item.id())))
                .toList();
        return new AccommodationSearchResponse(response.total(), response.page(), response.size(), response.hasNext(), items);
    }

    @Transactional
    public void add(String loginId, Long accommodationId) {
        if (favoriteRepository.findByUserLoginIdAndAccommodationId(loginId, accommodationId).isPresent()) {
            return;
        }
        User user = userRepository.findByLoginId(loginId)
                .orElseThrow(() -> new NoSuchElementException("로그인 정보를 찾을 수 없습니다."));
        Accommodation accommodation = accommodationRepository.findById(accommodationId)
                .orElseThrow(() -> new NoSuchElementException("숙소를 찾을 수 없습니다."));
        favoriteRepository.save(AccommodationFavorite.builder()
                .user(user)
                .accommodation(accommodation)
                .build());
    }

    @Transactional
    public void remove(String loginId, Long accommodationId) {
        favoriteRepository.findByUserLoginIdAndAccommodationId(loginId, accommodationId)
                .ifPresent(favoriteRepository::delete);
    }
}