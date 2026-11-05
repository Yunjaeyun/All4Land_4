package com.example.AllForLand_SideProj;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

@Controller
public class MapController {
    private final Environment environment;

    public MapController(Environment environment) {
        this.environment = environment;
    }
    @Value("${google.maps.key}")
    private String mapsKey;

    @GetMapping("/")
    public String map(Model model) {
        model.addAttribute("mapsKey", mapsKey);
        model.addAttribute("layerDatabaseStorage", environment.acceptsProfiles(Profiles.of("layer-db")));
        return "map";
    }

}
