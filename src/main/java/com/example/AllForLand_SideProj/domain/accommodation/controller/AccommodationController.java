package com.example.AllForLand_SideProj.domain.accommodation.controller;

import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSearchRequest;
import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSearchResponse;
import com.example.AllForLand_SideProj.domain.accommodation.service.AccommodationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/accommodations")
@Profile("!map-only")
@RequiredArgsConstructor
public class AccommodationController {

    private final AccommodationService accommodationService;
    
    @GetMapping("/boroughs")
    public List<String> boroughs() {
        return accommodationService.boroughs();
    }

    @GetMapping("/search")
    public AccommodationSearchResponse search(@Valid AccommodationSearchRequest request) {
        return accommodationService.search(request);
    }
}
