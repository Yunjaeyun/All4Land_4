package com.example.AllForLand_SideProj.domain.accommodation.service;

import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSearchRequest;
import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSearchResponse;
import com.example.AllForLand_SideProj.domain.accommodation.dto.AccommodationSort;
import com.example.AllForLand_SideProj.domain.accommodation.entity.Accommodation;
import com.example.AllForLand_SideProj.domain.accommodation.enums.RoomType;
import com.example.AllForLand_SideProj.domain.accommodation.repository.AccommodationRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AccommodationServiceTests {

    private final AccommodationRepository repository = mock(AccommodationRepository.class);
    private final AccommodationService service = new AccommodationService(repository);

    private static AccommodationSearchRequest request(BigDecimal minPrice, BigDecimal maxPrice,
                                                      AccommodationSort sort, Integer page, Integer size) {
        return new AccommodationSearchRequest(null, null, minPrice, maxPrice, null, null, null, null, null, sort, page, size);
    }

    @Test
    void searchRejectsMinPriceAboveMaxPrice() {
        var request = request(new BigDecimal("500"), new BigDecimal("100"), null, null, null);

        assertThrows(IllegalArgumentException.class, () -> service.search(request));
        verifyNoInteractions(repository);
    }

    @Test
    @SuppressWarnings("unchecked")
    void searchUsesDefaultPagingAndPriceSortWhenNotGiven() {
        when(repository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        service.search(request(null, null, null, null, null));

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(any(Specification.class), pageable.capture());
        assertEquals(0, pageable.getValue().getPageNumber());
        assertEquals(20, pageable.getValue().getPageSize());
        assertEquals(org.springframework.data.domain.Sort.Direction.ASC,
                pageable.getValue().getSort().getOrderFor("priceTotal").getDirection());
        assertNotNull(pageable.getValue().getSort().getOrderFor("id"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void searchReturnsItemsWithPagingInfoEvenWithoutSafetyZone() {
        Accommodation accommodation = Accommodation.builder()
                .name("Camden · 전체 집 · 침실 1개")
                .roomType(RoomType.ENTIRE_HOME)
                .priceTotal(new BigDecimal("323.03"))
                .latitude(new BigDecimal("51.46531"))
                .longitude(new BigDecimal("-0.16032"))
                .maxGuests(2)
                .bedrooms(1)
                .isSuperhost(true)
                .build();
        when(repository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(accommodation), PageRequest.of(1, 1), 3));

        AccommodationSearchResponse response = service.search(request(null, null, AccommodationSort.PRICE_DESC, 1, 1));

        assertEquals(3, response.total());
        assertEquals(1, response.page());
        assertTrue(response.hasNext());
        assertEquals(1, response.items().size());
        assertEquals("Camden · 전체 집 · 침실 1개", response.items().get(0).name());
        assertNull(response.items().get(0).lsoaName());
        assertNull(response.items().get(0).safetyLevel());
    }
}
