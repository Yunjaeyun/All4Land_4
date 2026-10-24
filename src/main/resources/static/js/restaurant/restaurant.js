/* 맛집 레이어: 목록 마커 표시와 지도 클릭으로 맛집 등록 (/api/restaurants) */
const SAFETY_LABELS = ["매우 안전", "안전", "보통", "주의", "위험"];

async function initRestaurants(map) {
    const toggle = document.getElementById("layer-restaurant");
    const addButton = document.getElementById("restaurant-add");
    const hint = document.getElementById("restaurant-hint");
    const form = document.getElementById("restaurant-form");
    const coords = document.getElementById("restaurant-coords");
    const submitButton = document.getElementById("restaurant-submit");
    const message = document.getElementById("restaurant-message");
    const infoWindow = new google.maps.InfoWindow();
    const markers = [];
    let picking = false;
    let picked = null;
    let draftMarker = null;

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle("error", isError);
        message.hidden = false;
    }

    function infoContent(restaurant) {
        const box = document.createElement("div");
        const title = document.createElement("strong");
        box.className = "restaurant-info";
        title.textContent = restaurant.name;
        box.append(title);
        const detail = [restaurant.cuisineType, restaurant.rating != null ? `★ ${restaurant.rating}` : null]
            .filter(Boolean).join(" · ");
        [
            restaurant.address,
            detail,
            `${restaurant.lsoaName} · 치안 ${restaurant.safetyLevel}등급 (${SAFETY_LABELS[restaurant.safetyLevel - 1]})`
        ].filter(Boolean).forEach((line) => {
            const row = document.createElement("div");
            row.textContent = line;
            box.append(row);
        });
        return box;
    }

    function addMarker(restaurant) {
        const marker = new google.maps.Marker({
            position: { lat: Number(restaurant.latitude), lng: Number(restaurant.longitude) },
            map: toggle.checked ? map : null,
            title: restaurant.name,
            zIndex: 10,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#e8590c",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
            }
        });
        marker.addListener("click", () => {
            infoWindow.setContent(infoContent(restaurant));
            infoWindow.open({ map, anchor: marker });
        });
        markers.push(marker);
    }

    function resetAdding() {
        picking = false;
        picked = null;
        hint.hidden = true;
        form.hidden = true;
        form.reset();
        addButton.disabled = false;
        map.setOptions({ draggableCursor: null });
        if (draftMarker) draftMarker.setMap(null);
        draftMarker = null;
    }

    toggle.addEventListener("change", () => {
        markers.forEach((marker) => marker.setMap(toggle.checked ? map : null));
        if (!toggle.checked) infoWindow.close();
    });

    addButton.addEventListener("click", () => {
        picking = true;
        addButton.disabled = true;
        hint.hidden = false;
        message.hidden = true;
        map.setOptions({ draggableCursor: "crosshair" });
    });
    document.getElementById("restaurant-pick-cancel").addEventListener("click", resetAdding);
    document.getElementById("restaurant-form-cancel").addEventListener("click", resetAdding);

    // 다른 메뉴로 넘어가면 추가 작업을 취소해 내 레이어 그리기와 클릭이 겹치지 않게 한다
    window.addEventListener("app:menu", (event) => {
        if (event.detail.menu !== "restaurant" && (picking || !form.hidden)) resetAdding();
    });

    // 위치 선택 중이거나 폼이 열려 있으면 클릭한 곳으로 위치를 옮긴다
    map.addListener("click", (event) => {
        if (document.body.dataset.activeMenu !== "restaurant") return;
        if (!picking && form.hidden) return;
        picking = false;
        picked = event.latLng;
        hint.hidden = true;
        form.hidden = false;
        map.setOptions({ draggableCursor: null });
        coords.textContent = `위치 ${picked.lat().toFixed(6)}, ${picked.lng().toFixed(6)} · 지도를 다시 클릭하면 위치가 바뀝니다`;
        if (!draftMarker) draftMarker = new google.maps.Marker({ map, zIndex: 20 });
        draftMarker.setPosition(picked);
        form.elements.name.focus();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const rating = data.get("rating");
        submitButton.disabled = true;
        try {
            const response = await fetch("/api/restaurants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.get("name"),
                    address: data.get("address"),
                    cuisineType: data.get("cuisineType") || null,
                    rating: rating === "" ? null : Number(rating),
                    latitude: picked.lat(),
                    longitude: picked.lng()
                })
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                showMessage(body.message || `저장에 실패했습니다. (HTTP ${response.status})`, true);
                return;
            }
            toggle.checked = true;
            markers.forEach((marker) => marker.setMap(map));
            addMarker(body);
            resetAdding();
            showMessage(`'${body.name}'을(를) 등록했습니다.`);
        } catch (error) {
            showMessage("서버에 연결할 수 없습니다.", true);
        } finally {
            submitButton.disabled = false;
        }
    });

    try {
        const response = await fetch("/api/restaurants");
        if (!response.ok) throw new Error(`Restaurant HTTP ${response.status}`);
        (await response.json()).forEach(addMarker);
        toggle.disabled = false;
        addButton.disabled = false;
    } catch (error) {
        showMessage("맛집은 DB에 연결된 상태에서만 이용할 수 있습니다.", true);
    }
}
