package com.example.AllForLand_SideProj.customlayer.ranking;

import com.example.AllForLand_SideProj.customlayer.storage.LayerDocument;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Read-only analysis of supplied geometry. Never saves a snapshot or accepts an owner ID. */
@RestController
@RequestMapping("/api/custom-layers/ranking")
public class LayerRankingController {
    private final LayerRankingService service;
    public LayerRankingController(LayerRankingService service) { this.service = service; }
    @PostMapping
    public ResponseEntity<LayerRankingService.Result> rank(@RequestBody LayerDocument document,
            @RequestParam(defaultValue = "interest") String order) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.rank(document, order));
    }
}
