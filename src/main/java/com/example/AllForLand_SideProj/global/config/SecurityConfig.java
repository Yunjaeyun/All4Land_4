package com.example.AllForLand_SideProj.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/login", "/signup", "/entry.html", "/map", "/custom-layers", "/error",
                                "/css/**", "/js/**", "/data/**", "/favicon.ico").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/custom-layers/ranking").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/restaurants/**").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/restaurants/**").authenticated()
                        .requestMatchers("/api/custom-layers/**").authenticated()
                        .anyRequest().permitAll())
                .formLogin(form -> form
                        .loginPage("/login")
                        .defaultSuccessUrl("/map", true)
                        .permitAll())
                .logout(logout -> logout.logoutSuccessUrl("/"))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}