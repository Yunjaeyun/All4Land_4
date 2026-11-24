package com.example.AllForLand_SideProj.domain.accommodation.controller;

import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSearchRequest;
import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSearchResponse;
import com.example.AllForLand_SideProj.domain.accommodation.service.AccommodationFavoriteService;
import com.example.AllForLand_SideProj.domain.accommodation.service.AccommodationService;
import com.example.AllForLand_SideProj.global.security.LoginUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.util.List;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/accommodations")
@Profile("!map-only")
@RequiredArgsConstructor
public class AccommodationController {

    private final AccommodationService accommodationService;
    private final AccommodationFavoriteService favoriteService;

    @GetMapping("/boroughs")
    public List<String> boroughs() {
        return accommodationService.boroughs();
    }

    @GetMapping("/borough-counts")
    public Map<String, Long> boroughCounts() {
        return accommodationService.boroughCounts();
    }

    @GetMapping("/search")
    public AccommodationSearchResponse search(@Valid AccommodationSearchRequest request, Authentication authentication) {
        AccommodationSearchResponse response = accommodationService.search(request);
        return favoriteService.markFavorited(response, LoginUser.loginId(authentication));
    }
}