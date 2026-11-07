package com.example.AllForLand_SideProj.customlayer.storage;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("layer-db | !prod")
@RequestMapping("/api/custom-layers")
public class LayerStorageController implements HttpSessionListener {
    private final LayerStorageService service;
    private final LayerRepository repository;
    private final LayerWorkspaceResolver workspaceResolver;

    public LayerStorageController(LayerStorageService service, LayerRepository repository, LayerWorkspaceResolver workspaceResolver) {
        this.service = service;
        this.repository = repository;
        this.workspaceResolver = workspaceResolver;
    }
    @GetMapping
    public ResponseEntity<LayerDocument> list(HttpServletRequest request, HttpServletResponse response,
            @RequestParam(required = false) Integer month, @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.findAll(workspaceResolver.resolve(request, response), month, start, end));
    }
    @PutMapping
    public ResponseEntity<LayerDocument> save(HttpServletRequest request, HttpServletResponse response, @RequestBody LayerDocument layers) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.save(workspaceResolver.resolve(request, response), layers));
    }
    @Override
    public void sessionDestroyed(HttpSessionEvent event) { repository.deleteWorkspace(event.getSession().getId()); }
}
