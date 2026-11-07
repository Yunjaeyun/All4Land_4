package com.example.AllForLand_SideProj.customlayer.storage;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("layer-db | !prod")
public class LayerStorageService {
    private final LayerRepository repository;

    public LayerStorageService(LayerRepository repository) { this.repository = repository; }

    public LayerDocument findAll(String workspace, Integer month, String start, String end) {
        check(month == null || month >= 1 && month <= 12, "월은 1~12여야 합니다.");
        check(start == null && end == null || validTime(start) && validTime(end), "시작·종료 시간을 함께 입력하세요.");
        return new LayerDocument(repository.findAll(workspace).features().stream().filter(layer ->
            (month == null || layer.month() == month) && (start == null || (start.compareTo(end) <= 0
                ? layer.time().compareTo(start) >= 0 && layer.time().compareTo(end) <= 0
                : layer.time().compareTo(start) >= 0 || layer.time().compareTo(end) <= 0))).toList());
    }

    /** Validate the entire request before replacing the workspace, so failures never lose old data. */
    public LayerDocument save(String workspace, LayerDocument layerDocument) {
        var snapshot = LayerDocumentValidator.validate(layerDocument);
        repository.replaceAll(workspace, snapshot);
        return snapshot;
    }

    private boolean validTime(String time) { return time != null && time.matches("([01]\\d|2[0-3]):[0-5]\\d"); }
    private void check(boolean valid, String message) { if (!valid) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
