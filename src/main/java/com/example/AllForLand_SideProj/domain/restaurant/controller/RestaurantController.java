package com.example.AllForLand_SideProj.domain.restaurant.controller;

import com.example.AllForLand_SideProj.domain.restaurant.dto.RestaurantCreateRequest;
import com.example.AllForLand_SideProj.domain.restaurant.dto.RestaurantResponse;
import com.example.AllForLand_SideProj.domain.restaurant.service.RestaurantService;
import com.example.AllForLand_SideProj.global.security.LoginUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants")
@Profile("!map-only")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService restaurantService;

    @GetMapping
    public List<RestaurantResponse> findAll(@RequestParam(name = "scope", defaultValue = "all") String scope,
                                            Authentication authentication) {
        String loginId = LoginUser.loginId(authentication);
        boolean mineOnly = "mine".equals(scope);
        if (mineOnly && loginId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return restaurantService.findAll(loginId, mineOnly);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RestaurantResponse create(@Valid @RequestBody RestaurantCreateRequest request,
                                     Authentication authentication) {
        return restaurantService.create(request, LoginUser.loginId(authentication));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("id") Long id, Authentication authentication) {
        restaurantService.delete(id, LoginUser.loginId(authentication));
    }
}