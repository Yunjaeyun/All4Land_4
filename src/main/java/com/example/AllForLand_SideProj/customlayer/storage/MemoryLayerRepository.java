package com.example.AllForLand_SideProj.customlayer.storage;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Repository;
import org.springframework.context.annotation.Profile;

@Repository
@Profile("!layer-db & !prod")
public class MemoryLayerRepository implements LayerRepository {
    private final ConcurrentHashMap<String, LayerDocument> workspaces = new ConcurrentHashMap<>();

    public LayerDocument findAll(String workspace) {
        return workspaces.getOrDefault(workspace, new LayerDocument(List.of()));
    }

    public void replaceAll(String workspace, LayerDocument layer) {
        workspaces.put(workspace, new LayerDocument(List.copyOf(layer.features())));
    }

    public void deleteWorkspace(String workspace) {
        workspaces.remove(workspace);
    }
}
