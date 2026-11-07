package com.example.AllForLand_SideProj.customlayer.storage.db;

import com.example.AllForLand_SideProj.customlayer.storage.LayerWorkspaceResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.web.server.ResponseStatusException;

@Component
@Profile("layer-db")
public class DatabaseLayerWorkspaceResolver implements LayerWorkspaceResolver {
    private static final String COOKIE = "custom-layer-workspace";
    private final JdbcTemplate jdbc;
    private final Environment environment;

    public DatabaseLayerWorkspaceResolver(JdbcTemplate jdbc, Environment environment) {
        this.jdbc = jdbc;
        this.environment = environment;
    }
    public String resolve(HttpServletRequest request, HttpServletResponse response) {
        var principal = request.getUserPrincipal();
        if (principal != null) {
            var ids = jdbc.queryForList("SELECT user_id FROM users WHERE login_id = ?", Long.class, principal.getName());
            if (!ids.isEmpty()) return ids.getFirst().toString();
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "로그인 사용자 정보가 없습니다.");
        }
        // Explicit local development only. Never uses a browser-supplied user ID or a fallback in production.
        if (environment.acceptsProfiles(Profiles.of("layer-db-dev & !prod"))) {
            Long id = environment.getProperty("custom-layer.development-user-id", Long.class);
            if (id != null && !jdbc.queryForList("SELECT user_id FROM users WHERE user_id = ?", Long.class, id).isEmpty())
                return id.toString();
        }
        var cookies = request.getCookies();
        if (cookies != null) {
            for (var cookie : cookies) {
                if (COOKIE.equals(cookie.getName()) && cookie.getValue().matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")) {
                    return cookie.getValue();
                }
            }
        }
        String key = UUID.randomUUID().toString();
        response.addHeader("Set-Cookie", ResponseCookie.from(COOKIE, key).httpOnly(true)
                .secure(request.isSecure()).sameSite("Strict").path("/api/custom-layers")
                .maxAge(Duration.ofDays(365)).build().toString());
        return key;
    }
}
