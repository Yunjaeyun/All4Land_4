package com.example.AllForLand_SideProj.customlayer.storage;


public interface LayerRepository {
    LayerDocument findAll(String workspace);
    void replaceAll(String workspace, LayerDocument layer);
    void deleteWorkspace(String workspace);
}
