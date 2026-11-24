package com.example.AllForLand_SideProj.domain.user.controller;

import com.example.AllForLand_SideProj.domain.user.entity.User;
import com.example.AllForLand_SideProj.domain.user.repository.UserRepository;
import com.example.AllForLand_SideProj.global.security.LoginUser;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

@ControllerAdvice
@Profile("!map-only")
@RequiredArgsConstructor
public class UserProfileAdvice {

    private final UserRepository userRepository;

    @ModelAttribute("nickname")
    public String nickname(Authentication authentication) {
        String loginId = LoginUser.loginId(authentication);
        if (loginId == null) {
            return null;
        }
        return userRepository.findByLoginId(loginId)
                .map(User::getNickname)
                .orElse(null);
    }
}