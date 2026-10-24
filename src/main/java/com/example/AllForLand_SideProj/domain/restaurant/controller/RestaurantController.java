package com.example.AllForLand_SideProj.domain.restaurant.controller;

import com.example.AllForLand_SideProj.domain.restaurant.dto.RestaurantCreateRequest;
import com.example.AllForLand_SideProj.domain.restaurant.dto.RestaurantResponse;
import com.example.AllForLand_SideProj.domain.restaurant.service.RestaurantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants")
@Profile("!map-only")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService restaurantService;

    @GetMapping
    public List<RestaurantResponse> findAll() {
        return restaurantService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RestaurantResponse create(@Valid @RequestBody RestaurantCreateRequest request) {
        return restaurantService.create(request);
    }
}
