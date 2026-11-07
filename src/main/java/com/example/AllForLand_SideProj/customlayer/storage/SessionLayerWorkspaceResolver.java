package com.example.AllForLand_SideProj.customlayer.storage;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!layer-db & !prod")
public class SessionLayerWorkspaceResolver implements LayerWorkspaceResolver {
    public String resolve(HttpServletRequest request, HttpServletResponse response) { return request.getSession().getId(); }
}
