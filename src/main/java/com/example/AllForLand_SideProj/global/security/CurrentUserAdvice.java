package com.example.AllForLand_SideProj.global.security;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

@ControllerAdvice
public class CurrentUserAdvice {

    @ModelAttribute("loginId")
    public String loginId(Authentication authentication) {
        return LoginUser.loginId(authentication);
    }
}