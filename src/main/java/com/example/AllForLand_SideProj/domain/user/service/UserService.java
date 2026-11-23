package com.example.AllForLand_SideProj.domain.user.service;

import com.example.AllForLand_SideProj.domain.user.dto.SignupRequest;
import com.example.AllForLand_SideProj.domain.user.entity.User;
import com.example.AllForLand_SideProj.domain.user.enums.UserRole;
import com.example.AllForLand_SideProj.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!map-only")
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public void signup(SignupRequest request) {
        String loginId = request.loginId().strip();
        if (userRepository.existsByLoginId(loginId)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }
        userRepository.save(User.builder()
                .loginId(loginId)
                .password(passwordEncoder.encode(request.password()))
                .nickname(request.nickname().strip())
                .role(UserRole.USER)
                .build());
    }
}