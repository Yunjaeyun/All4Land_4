package com.example.AllForLand_SideProj.customlayer.storage;

import jakarta.servlet.http.HttpServletRequest;

/** Resolves ownership on the server; clients never supply a user ID. */
public interface LayerWorkspaceResolver {
    String resolve(HttpServletRequest request);
}
