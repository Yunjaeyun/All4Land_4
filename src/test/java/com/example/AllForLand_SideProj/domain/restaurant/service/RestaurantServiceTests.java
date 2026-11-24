package com.example.AllForLand_SideProj.domain.restaurant.service;

import com.example.AllForLand_SideProj.domain.restaurant.entity.Restaurant;
import com.example.AllForLand_SideProj.domain.restaurant.repository.RestaurantRepository;
import com.example.AllForLand_SideProj.domain.safetyzone.repository.SafetyZoneRepository;
import com.example.AllForLand_SideProj.domain.user.entity.User;
import com.example.AllForLand_SideProj.domain.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RestaurantServiceTests {

    private final RestaurantRepository restaurantRepository = mock(RestaurantRepository.class);
    private final RestaurantService restaurantService =
            new RestaurantService(restaurantRepository, mock(SafetyZoneRepository.class), mock(UserRepository.class));

    @Test
    void ownerCanDeleteOwnRestaurant() {
        User owner = User.builder().loginId("owner").build();
        Restaurant restaurant = Restaurant.builder().name("Dishoom").user(owner).build();
        when(restaurantRepository.findById(1L)).thenReturn(Optional.of(restaurant));

        restaurantService.delete(1L, "owner");

        verify(restaurantRepository).delete(restaurant);
    }

    @Test
    void otherUserCannotDeleteRestaurant() {
        User owner = User.builder().loginId("owner").build();
        Restaurant restaurant = Restaurant.builder().name("Dishoom").user(owner).build();
        when(restaurantRepository.findById(1L)).thenReturn(Optional.of(restaurant));

        assertThrows(AccessDeniedException.class, () -> restaurantService.delete(1L, "someone"));
        verify(restaurantRepository, never()).delete(any());
    }

    @Test
    void nobodyCanDeleteRestaurantWithoutOwner() {
        Restaurant restaurant = Restaurant.builder().name("Dishoom").build();
        when(restaurantRepository.findById(1L)).thenReturn(Optional.of(restaurant));

        assertThrows(AccessDeniedException.class, () -> restaurantService.delete(1L, "owner"));
        verify(restaurantRepository, never()).delete(any());
    }

    @Test
    void deleteThrowsWhenRestaurantDoesNotExist() {
        when(restaurantRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class, () -> restaurantService.delete(99L, "owner"));
        verify(restaurantRepository, never()).delete(any());
    }
}