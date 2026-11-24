package com.example.AllForLand_SideProj.domain.user.controller;

import com.example.AllForLand_SideProj.domain.user.dto.SignupRequest;
import com.example.AllForLand_SideProj.domain.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;

@Controller
@Profile("!map-only")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @GetMapping("/login")
    public String loginPage() {
        return "auth/login";
    }

    @GetMapping("/signup")
    public String signupPage(Model model) {
        model.addAttribute("signupRequest", new SignupRequest("", "", "", ""));
        return "auth/signup";
    }

    @PostMapping("/signup")
    public String signup(@Valid @ModelAttribute("signupRequest") SignupRequest request,
                         BindingResult bindingResult) {
        String password = request.password();
        String confirm = request.passwordConfirm();
        if (password != null && confirm != null && !confirm.isEmpty() && !password.equals(confirm)) {
            bindingResult.rejectValue("passwordConfirm", "mismatch", "비밀번호가 서로 달라요. 다시 확인해 주세요.");
        }
        if (bindingResult.hasErrors()) {
            return "auth/signup";
        }
        try {
            userService.signup(request);
        } catch (IllegalArgumentException e) {
            bindingResult.rejectValue("loginId", "duplicate", e.getMessage());
            return "auth/signup";
        }
        return "redirect:/login?signup";
    }
}