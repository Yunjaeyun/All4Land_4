package com.example.AllForLand_SideProj.customlayer.storage;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!layer-db & !prod")
public class SessionLayerWorkspaceResolver implements LayerWorkspaceResolver {
    public String resolve(HttpServletRequest request) { return request.getSession().getId(); }
}
