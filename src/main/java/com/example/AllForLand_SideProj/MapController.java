package com.example.AllForLand_SideProj;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MapController {
    @Value("${google.maps.key}")
    private String mapsKey;

    @GetMapping("/")
    public String map(Model model) {
        model.addAttribute("mapsKey", mapsKey);
        return "map";
    }

}
