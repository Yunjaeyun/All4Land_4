package com.example.AllForLand_SideProj.customlayer;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class CustomLayerController {

    @GetMapping("/custom-layers")
    public String index() {
        return "redirect:/?menu=custom-layer";
    }
}
