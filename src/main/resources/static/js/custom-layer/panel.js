(() => {
    const mapPanel = document.getElementById("map-panel");
    const customPanel = document.getElementById("custom-layer-panel");
    const tabs = [...document.querySelectorAll("[data-layer-tab]")];
    const latitude = document.getElementById("layer-latitude");
    const longitude = document.getElementById("layer-longitude");
    const feedback = document.getElementById("layer-feedback");
    let previewUrl = null;
    window.addEventListener("custom-layer:photo-reset", () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        const preview = document.getElementById("layer-photo-preview");
        preview.hidden = true;
        preview.removeAttribute("src");
    });

    function selectMenu(menu) {
        document.body.dataset.activeMenu = menu;
        mapPanel.hidden = menu !== "map";
        customPanel.hidden = menu !== "custom-layer";
        document.querySelectorAll(".app-nav [data-menu]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.menu === menu));
        });
        window.dispatchEvent(new CustomEvent("app:menu", { detail: { menu } }));
    }
    document.querySelectorAll("[data-menu]").forEach((button) => {
        button.addEventListener("click", () => selectMenu(button.dataset.menu));
    });
    function selectTab(selected) {
        tabs.forEach((tab) => {
            const active = tab === selected;
            tab.setAttribute("aria-selected", String(active));
            tab.tabIndex = active ? 0 : -1;
            document.getElementById(tab.dataset.layerTab).hidden = !active;
        });
        window.dispatchEvent(new CustomEvent("custom-layer:tab"));
    }
    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => selectTab(tab));
        tab.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
                : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            selectTab(tabs[next]);
            tabs[next].focus();
        });
    });
    document.querySelectorAll(".month-options").forEach((select) => {
        if (select.id === "query-month") select.add(new Option("전체 월", ""));
        for (let month = 1; month <= 12; month++) select.add(new Option(`${month}월`, String(month)));
        select.value = select.id === "query-month" ? "" : String(new Date().getMonth() + 1);
    });
    function updatePosition() {
        if (latitude.value === "" || longitude.value === "") {
            feedback.textContent = "위도와 경도를 모두 입력하세요.";
            return;
        }
        if (!latitude.checkValidity() || !longitude.checkValidity()) {
            feedback.textContent = "위도는 -90~90, 경도는 -180~180 범위로 입력하세요.";
            return;
        }
        const position = { lat: Number(latitude.value), lng: Number(longitude.value) };
        feedback.textContent = "좌표를 전달했습니다. 그리기 도구에서 결과를 확인하세요.";
        window.dispatchEvent(new CustomEvent("custom-layer:position", { detail: position }));
    }
    window.addEventListener("custom-layer:map-click", (event) => {
        latitude.value = event.detail.lat.toFixed(6);
        longitude.value = event.detail.lng.toFixed(6);
        feedback.textContent = "클릭한 위치에 마커를 추가했습니다.";
    });
    document.getElementById("add-coordinate-marker").addEventListener("click", updatePosition);
    document.getElementById("layer-photo").addEventListener("change", (event) => {
        const preview = document.getElementById("layer-photo-preview");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        preview.hidden = true;
        preview.removeAttribute("src");
        const file = event.target.files[0];
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
            feedback.textContent = "5MB 이하의 JPG, PNG, WebP 사진을 선택하세요.";
            event.target.value = "";
            return;
        }
        previewUrl = URL.createObjectURL(file);
        preview.src = previewUrl;
        preview.hidden = false;
        feedback.textContent = "사진 미리보기입니다. 아직 서버에 저장되지 않습니다.";
    });
    customPanel.querySelectorAll("form").forEach((form) => form.addEventListener("submit", (event) => event.preventDefault()));
    selectMenu(new URLSearchParams(location.search).get("menu") === "map" ? "map" : "custom-layer");
})();
