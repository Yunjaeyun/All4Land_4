const SAFETY_LABELS = ["매우 안전", "안전", "보통", "주의", "위험"];

async function initRestaurants(map) {
    const toggle = document.getElementById("layer-restaurant");
    const addButton = document.getElementById("restaurant-add");
    const hint = document.getElementById("restaurant-hint");
    const form = document.getElementById("restaurant-form");
    const coords = document.getElementById("restaurant-coords");
    const submitButton = document.getElementById("restaurant-submit");
    const message = document.getElementById("restaurant-message");
    const list = document.getElementById("restaurant-list");
    const count = document.getElementById("restaurant-count");
    const empty = document.getElementById("restaurant-empty");
    const scopeBox = document.querySelector(".restaurant-scope");
    const allButton = document.getElementById("restaurant-scope-all");
    const mineButton = document.getElementById("restaurant-scope-mine");
    const scopeHint = document.getElementById("restaurant-scope-hint");
    const infoWindow = new google.maps.InfoWindow();
    const entries = new Map();
    let openEntry = null;
    let picking = false;
    let picked = null;
    let draftMarker = null;
    let scope = "all";
    let loadRevision = 0;

    const loggedIn = scopeBox.dataset.loggedIn === "true";
    mineButton.disabled = !loggedIn;
    scopeHint.hidden = loggedIn;

    const baseStyles = map.get("styles") || [];
    const restaurantStyles = [...baseStyles, { featureType: "poi.business", stylers: [{ visibility: "on" }] }];
    function syncMapStyles() {
        map.setOptions({ styles: document.body.dataset.activeMenu === "restaurant" ? restaurantStyles : baseStyles });
    }
    syncMapStyles();

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle("error", isError);
        message.hidden = false;
    }

    function failureText(response, body, fallback) {
        if (body.message) return body.message;
        if (response.status === 401) return "로그인하면 맛집을 등록하고 관리할 수 있어요.";
        return fallback;
    }

    function infoContent(restaurant) {
        const box = document.createElement("div");
        box.className = "restaurant-info";

        const head = document.createElement("div");
        head.className = "ri-head";
        const title = document.createElement("strong");
        title.textContent = restaurant.name;
        const safety = document.createElement("span");
        safety.className = `ri-safety level-${restaurant.safetyLevel}`;
        safety.textContent = `치안 ${restaurant.safetyLevel}등급 · ${SAFETY_LABELS[restaurant.safetyLevel - 1]}`;
        head.append(title, safety);
        box.append(head);

        if (restaurant.address) {
            const address = document.createElement("p");
            address.className = "ri-address";
            address.textContent = restaurant.address;
            box.append(address);
        }

        const tags = [restaurant.cuisineType, restaurant.rating != null ? `★ ${restaurant.rating}` : null].filter(Boolean);
        if (tags.length) {
            const row = document.createElement("div");
            row.className = "ri-tags";
            tags.forEach((tag) => {
                const chip = document.createElement("span");
                chip.className = "ri-tag";
                chip.textContent = tag;
                row.append(chip);
            });
            box.append(row);
        }

        const foot = document.createElement("div");
        foot.className = "ri-foot";
        const author = document.createElement("span");
        author.className = "ri-author";
        author.textContent = restaurant.authorNickname ? `등록자 ${restaurant.authorNickname}` : "등록자 정보 없음";
        const area = document.createElement("span");
        area.className = "ri-area";
        area.textContent = restaurant.lsoaName || "";
        foot.append(author, area);
        box.append(foot);
        return box;
    }

    function detailText(restaurant) {
        return [restaurant.cuisineType, restaurant.rating != null ? `★ ${restaurant.rating}` : null]
            .filter(Boolean).join(" · ");
    }

    function syncListState() {
        count.textContent = entries.size;
        empty.hidden = entries.size > 0;
    }

    function showMarkers() {
        toggle.checked = true;
        entries.forEach(({ marker }) => marker.setMap(map));
    }

    function openInfo(entry) {
        infoWindow.setContent(infoContent(entry.restaurant));
        infoWindow.open({ map, anchor: entry.marker });
        openEntry = entry;
    }

    function listItem(entry) {
        const { restaurant } = entry;
        const item = document.createElement("li");
        const focusButton = document.createElement("button");
        const name = document.createElement("strong");
        const sub = document.createElement("span");
        const author = document.createElement("span");
        focusButton.type = "button";
        focusButton.className = "restaurant-item";
        name.textContent = restaurant.name;
        sub.textContent = detailText(restaurant) || restaurant.address;
        author.textContent = restaurant.authorNickname ? `등록자 ${restaurant.authorNickname}` : "등록자 정보 없음";
        focusButton.append(name, sub, author);
        focusButton.addEventListener("click", () => {
            showMarkers();
            map.panTo(entry.marker.getPosition());
            if (map.getZoom() < 15) map.setZoom(15);
            openInfo(entry);
        });
        item.append(focusButton);
        if (restaurant.mine) {
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "button danger";
            deleteButton.textContent = "삭제";
            deleteButton.setAttribute("aria-label", `${restaurant.name} 삭제`);
            deleteButton.addEventListener("click", () => deleteRestaurant(entry, deleteButton));
            item.append(deleteButton);
        }
        return item;
    }

    function removeEntry(id) {
        const entry = entries.get(id);
        if (!entry) return;
        if (openEntry === entry) infoWindow.close();
        entry.marker.setMap(null);
        entry.item.remove();
        entries.delete(id);
        syncListState();
    }

    function clearEntries() {
        infoWindow.close();
        openEntry = null;
        entries.forEach(({ marker, item }) => {
            marker.setMap(null);
            item.remove();
        });
        entries.clear();
        syncListState();
    }

    async function deleteRestaurant(entry, button) {
        const { restaurant } = entry;
        if (!confirm(`'${restaurant.name}'을(를) 삭제할까요?`)) return;
        button.disabled = true;
        try {
            const response = await fetch(`/api/restaurants/${restaurant.id}`, {
                method: "DELETE",
                headers: csrfHeaders()
            });
            if (response.status === 403) {
                showMessage("본인이 등록한 맛집만 삭제할 수 있어요.", true);
                return;
            }
            if (!response.ok && response.status !== 404) {
                const body = await response.json().catch(() => ({}));
                showMessage(failureText(response, body, `삭제에 실패했습니다. (HTTP ${response.status})`), true);
                return;
            }
            removeEntry(restaurant.id);
            showMessage(`'${restaurant.name}'을(를) 삭제했습니다.`);
        } catch (error) {
            showMessage("서버에 연결할 수 없습니다.", true);
        } finally {
            button.disabled = false;
        }
    }

    function addRestaurant(restaurant, { prepend = false } = {}) {
        const marker = new google.maps.Marker({
            position: { lat: Number(restaurant.latitude), lng: Number(restaurant.longitude) },
            map: toggle.checked ? map : null,
            title: restaurant.name,
            zIndex: 10,
            icon: {
                url: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'><path d='M16 1.5C8.3 1.5 2 7.8 2 15.5 2 25.5 16 38.5 16 38.5S30 25.5 30 15.5C30 7.8 23.7 1.5 16 1.5Z' fill='#c27a3a' stroke='#ffffff' stroke-width='2.2'/><g transform='translate(16 15) scale(0.5) translate(-12 -12)' fill='none' stroke='#ffffff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2'/><path d='M7 2v20'/><path d='M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'/></g></svg>"),
                scaledSize: new google.maps.Size(32, 40),
                anchor: new google.maps.Point(16, 40)
            }
        });
        const entry = { restaurant, marker };
        entry.item = listItem(entry);
        marker.addListener("click", () => openInfo(entry));
        entries.set(restaurant.id, entry);
        if (prepend) list.prepend(entry.item);
        else list.append(entry.item);
        syncListState();
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

    async function loadRestaurants(nextScope) {
        const revision = ++loadRevision;
        scope = nextScope;
        clearEntries();
        let restaurants;
        try {
            const response = await fetch(`/api/restaurants?scope=${nextScope}`, {
                headers: { Accept: "application/json" }
            });
            const contentType = response.headers.get("content-type") || "";
            if (!response.ok || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("[맛집] 목록 응답 오류", response.status, contentType, text.slice(0, 300));
                throw new Error(`HTTP ${response.status}`);
            }
            restaurants = await response.json();
        } catch (error) {
            console.error("[맛집] 목록 불러오기 실패", error);
            if (revision !== loadRevision) return;
            showMessage("맛집 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", true);
            return;
        }
        if (revision !== loadRevision) return;
        try {
            restaurants.forEach((restaurant) => addRestaurant(restaurant));
            syncListState();
        } catch (error) {
            console.error("[맛집] 목록 표시 실패", error);
            showMessage("맛집을 표시하는 중 문제가 생겼어요. 페이지를 새로고침해 주세요.", true);
        }
    }

    function setScope(nextScope) {
        if (nextScope === scope) return;
        allButton.setAttribute("aria-pressed", String(nextScope === "all"));
        mineButton.setAttribute("aria-pressed", String(nextScope === "mine"));
        allButton.className = nextScope === "all" ? "button" : "button secondary";
        mineButton.className = nextScope === "mine" ? "button" : "button secondary";
        message.hidden = true;
        loadRestaurants(nextScope);
    }

    allButton.addEventListener("click", () => setScope("all"));
    mineButton.addEventListener("click", () => setScope("mine"));

    toggle.addEventListener("change", () => {
        entries.forEach(({ marker }) => marker.setMap(toggle.checked ? map : null));
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

    window.addEventListener("app:menu", (event) => {
        if (event.detail.menu !== "restaurant" && (picking || !form.hidden)) resetAdding();
        syncMapStyles();
    });

    map.addListener("click", (event) => {
        if (document.body.dataset.activeMenu !== "restaurant") return;
        if (!picking && form.hidden) return;
        if (event.placeId) event.stop();
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
                headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
                showMessage(failureText(response, body, `저장에 실패했습니다. (HTTP ${response.status})`), true);
                return;
            }
            showMarkers();
            addRestaurant(body, { prepend: true });
            resetAdding();
            showMessage(`'${body.name}'을(를) 등록했습니다.`);
        } catch (error) {
            showMessage("서버에 연결할 수 없습니다.", true);
        } finally {
            submitButton.disabled = false;
        }
    });

    await loadRestaurants("all");
    toggle.disabled = false;
    addButton.disabled = false;
}