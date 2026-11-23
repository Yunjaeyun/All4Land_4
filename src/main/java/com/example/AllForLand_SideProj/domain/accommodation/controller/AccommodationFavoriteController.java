package com.example.AllForLand_SideProj.domain.accommodation.controller;

import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationResponse;
import com.example.AllForLand_SideProj.domain.accommodation.service.AccommodationFavoriteService;
import com.example.AllForLand_SideProj.global.security.LoginUser;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/accommodations")
@Profile("!map-only")
@RequiredArgsConstructor
public class AccommodationFavoriteController {

    private final AccommodationFavoriteService favoriteService;

    @GetMapping("/favorites")
    public List<AccommodationResponse> favorites(Authentication authentication) {
        return favoriteService.findFavorites(requireLogin(authentication));
    }

    @PostMapping("/{id}/favorite")
    @ResponseStatus(HttpStatus.CREATED)
    public void add(@PathVariable("id") Long id, Authentication authentication) {
        favoriteService.add(requireLogin(authentication), id);
    }

    @DeleteMapping("/{id}/favorite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable("id") Long id, Authentication authentication) {
        favoriteService.remove(requireLogin(authentication), id);
    }

    private static String requireLogin(Authentication authentication) {
        String loginId = LoginUser.loginId(authentication);
        if (loginId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return loginId;
    }
}