package com.example.AllForLand_SideProj.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@Configuration
@EnableJpaAuditing
@Profile("!map-only")
public class JpaAuditingConfiguration {
}
