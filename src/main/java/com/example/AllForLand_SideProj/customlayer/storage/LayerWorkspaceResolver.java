package com.example.AllForLand_SideProj.customlayer.storage;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Resolves ownership on the server; clients never supply a user ID. */
public interface LayerWorkspaceResolver {
    String resolve(HttpServletRequest request, HttpServletResponse response);
}
