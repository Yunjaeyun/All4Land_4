package com.example.AllForLand_SideProj;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;


@EnableJpaAuditing
@SpringBootApplication
public class AllForLandSideProjApplication {

	public static void main(String[] args) {
		SpringApplication.run(AllForLandSideProjApplication.class, args);
	}

}
