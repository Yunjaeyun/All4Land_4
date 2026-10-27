const ACCOMMODATION_SAFETY_LABELS = ["매우 안전", "안전", "보통", "주의", "위험"];
const ACCOMMODATION_ROOM_LABELS = { ENTIRE_HOME: "전체 집", PRIVATE_ROOM: "개인실", SHARED_ROOM: "공용실" };
const ACCOMMODATION_DAY_LABELS = { weekday: "평일", weekend: "주말" };
const ACCOMMODATION_PAGE_SIZE = 20;

function initAccommodations(map) {
    const form = document.getElementById("accommodation-form");
    const submitButton = document.getElementById("accommodation-submit");
    const resetButton = document.getElementById("accommodation-reset");
    const message = document.getElementById("accommodation-message");
    const list = document.getElementById("accommodation-list");
    const count = document.getElementById("accommodation-count");
    const empty = document.getElementById("accommodation-empty");
    const moreButton = document.getElementById("accommodation-more");
    const topToggle = form.querySelector('[name="safestTop"]');
    const topSelect = form.querySelector('[name="topN"]');
    const sortSelect = form.querySelector('[name="sort"]');
    const infoWindow = new google.maps.InfoWindow({ maxWidth: 320 });
    const entries = [];
    const byKey = new Map();
    let query = null;
    let nextPage = 0;
    let requestId = 0;
    let firstOpen = true;
    const PIN_MIN_ZOOM = 11;
    const pinEntries = [];
    const pinsByKey = new Map();
    let pinRequestId = 0;
    let pinTimer = null;
    let menuActive = false;
    let showAllPins = false;
    let searchActive = false;
    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle("error", isError);
        message.hidden = false;
    }

    function formatNumber(value, digits = 0) {
        return Number(value).toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }

    function safetyLabel(level) {
        return level ? ACCOMMODATION_SAFETY_LABELS[level - 1] : null;
    }

    function syncTopMode() {
        const top = topToggle.checked;
        topSelect.disabled = !top;
        sortSelect.disabled = top;
        if (top) moreButton.hidden = true;
    }

    function groupKey(item) {
        return [item.latitude, item.longitude, item.roomType, item.maxGuests, item.bedrooms].join("|");
    }

    function dayPrice(entry, day) {
        const item = entry.items.find((row) => row.dayType === day);
        return item ? `£${formatNumber(item.priceTotal, 2)}` : null;
    }

    function displayName(entry) {
        const name = entry.items[0].name;
        return entry.rank ? `${entry.rank}. ${name}` : name;
    }

    function priceMain(entry) {
        const day = entry.items.some((row) => row.dayType === "weekday") ? "weekday" : "weekend";
        return dayPrice(entry, day);
    }

    function dayLabel(entry) {
        const hasWeekday = dayPrice(entry, "weekday") !== null;
        const hasWeekend = dayPrice(entry, "weekend") !== null;
        if (hasWeekday && hasWeekend) return "평일 · 주말";
        return hasWeekday ? "평일 기준" : "주말 기준";
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function stat(label, value) {
        const box = el("div", "acc-stat");
        box.append(el("span", "acc-stat-label", label), el("strong", "acc-stat-value", value));
        return box;
    }

    function showStreetView(target, entry) {
        const base = entry.items[0];
        const position = { lat: Number(base.latitude), lng: Number(base.longitude) };
        new google.maps.StreetViewService().getPanorama({ location: position, radius: 60 }, (data, status) => {
            if (status !== google.maps.StreetViewStatus.OK) {
                target.classList.add("is-empty");
                target.textContent = "이 주변은 스트리트뷰 사진이 없어요";
                return;
            }
            new google.maps.StreetViewPanorama(target, {
                pano: data.location.pano,
                pov: { heading: 0, pitch: 0 },
                zoom: 1,
                addressControl: false,
                fullscreenControl: false,
                motionTrackingControl: false,
                panControl: false
            });
        });
    }

    function infoContent(entry) {
        const base = entry.items[0];
        const box = el("div", "accommodation-info");
        const pano = el("div", "acc-pano");
        box.append(pano);

        const head = el("div", "acc-head");
        head.append(el("strong", "acc-title", displayName(entry)));
        head.append(el("span", `acc-safety level-${base.safetyLevel}`, `치안 ${safetyLabel(base.safetyLevel)}`));
        box.append(head);

        const price = el("div", "acc-price");
        price.append(el("strong", "acc-price-value", priceMain(entry)), el("span", "acc-price-label", `${dayLabel(entry)} · 총가격`));
        box.append(price);

        const stats = el("div", "acc-stats");
        stats.append(
            stat("인원", `최대 ${base.maxGuests}인`),
            stat("침실", `${base.bedrooms}개`),
            stat("만족도", formatNumber(base.satisfactionScore)),
            stat("청결", formatNumber(base.cleanlinessScore, 1)),
            stat("시내", `${formatNumber(base.distanceCityCenterKm, 1)}km`),
            stat("지하철", `${formatNumber(base.distanceMetroKm, 1)}km`)
        );
        box.append(stats);

        const meta = [ACCOMMODATION_ROOM_LABELS[base.roomType], base.isSuperhost ? "슈퍼호스트" : null, base.lsoaName].filter(Boolean).join(" · ");
        box.append(el("div", "acc-meta", meta));

        const link = el("a", "acc-route", "길찾기");
        link.href = `https://www.google.com/maps/dir/?api=1&destination=${base.latitude},${base.longitude}`;
        link.target = "_blank";
        link.rel = "noopener";
        box.append(link);
        return box;
    }

    function openInfo(entry) {
        const box = infoContent(entry);
        infoWindow.setContent(box);
        infoWindow.open({ map, anchor: entry.marker });
        google.maps.event.addListenerOnce(infoWindow, "domready", () => showStreetView(box.querySelector(".acc-pano"), entry));
    }

    function createEntry(item) {
        const entry = { items: [], rank: item.rank ?? null, marker: null, li: null, name: null, sub: null };
        entry.marker = new google.maps.Marker({
            position: { lat: Number(item.latitude), lng: Number(item.longitude) },
            map,
            zIndex: 8,
            label: entry.rank ? { text: String(entry.rank), color: "#ffffff", fontSize: "11px", fontWeight: "700" } : undefined,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: entry.rank ? 10 : 6,
                fillColor: "#1971c2",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
            }
        });
        const li = document.createElement("li");
        const button = document.createElement("button");
        entry.badge = document.createElement("span");
        entry.badge.className = "acc-badge";
        const body = document.createElement("span");
        body.className = "acc-body";
        entry.name = document.createElement("strong");
        entry.dots = document.createElement("span");
        entry.dots.className = "acc-dots";
        entry.sub = document.createElement("span");
        entry.sub.className = "acc-meta";
        body.append(entry.name, entry.dots, entry.sub);
        entry.price = document.createElement("span");
        entry.price.className = "acc-price";
        button.type = "button";
        button.className = "accommodation-item";
        button.append(entry.badge, body, entry.price);
        button.addEventListener("click", () => {
            map.panTo(entry.marker.getPosition());
            if (map.getZoom() < 14) map.setZoom(14);
            openInfo(entry);
        });
        entry.marker.addListener("click", () => openInfo(entry));
        li.append(button);
        list.append(li);
        entry.li = li;
        entries.push(entry);
        return entry;
    }

    function renumber() {
        entries.forEach((entry, index) => {
            entry.rank = topToggle.checked ? index + 1 : null;
            entry.marker.setLabel?.(entry.rank
                ? { text: String(entry.rank), color: "#ffffff", fontSize: "11px", fontWeight: "700" }
                : null);
            refresh(entry);
        });
    }

    function refresh(entry) {
        const base = entry.items[0];
        entry.name.textContent = base.name;
        entry.badge.textContent = entry.rank ?? "";
        entry.badge.hidden = !entry.rank;
        const filled = base.safetyLevel ? 6 - base.safetyLevel : 0;
        entry.dots.textContent = "●".repeat(filled) + "○".repeat(5 - filled) + (base.safetyLevel ? `  ${safetyLabel(base.safetyLevel)}` : "");
        entry.sub.textContent = `${base.maxGuests}인 · 만족도 ${base.satisfactionScore ? formatNumber(base.satisfactionScore) : "-"}`;
        const main = document.createElement("strong");
        main.textContent = priceMain(entry);
        const small = document.createElement("small");
        small.textContent = dayLabel(entry);
        entry.price.replaceChildren(main, small);
        entry.marker.setTitle?.(displayName(entry));
    }

    function attachItem(item) {
        const key = groupKey(item);
        const pin = pinsByKey.get(key);
        if (pin) {
            pin.marker?.setMap(null);
            pinsByKey.delete(key);
            pinEntries.splice(pinEntries.indexOf(pin), 1);
        }
        const cards = byKey.get(key) || [];
        let entry = cards.find((card) => !card.items.some((row) => row.dayType === item.dayType));
        if (!entry) {
            entry = createEntry(item);
            cards.push(entry);
            byKey.set(key, cards);
        }
        entry.items.push(item);
    }

    function addItems(items) {
        items.forEach(attachItem);
    }

    function clearEntries() {
        infoWindow.close();
        entries.forEach(({ marker, li }) => { marker.setMap(null); li.remove(); });
        entries.length = 0;
        byKey.clear();
    }

    function trimTo(n) {
        entries.slice(n).forEach(({ marker, li }) => { marker.setMap(null); li.remove(); });
        entries.splice(n);
    }

    function fitToResults() {
        if (entries.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        entries.forEach(({ marker }) => bounds.extend(marker.getPosition()));
        map.fitBounds(bounds, 40);
    }

    function buildQuery() {
        const params = new URLSearchParams();
        new FormData(form).forEach((value, key) => {
            if (String(value).trim() !== "") params.set(key, String(value).trim());
        });
        params.set("size", ACCOMMODATION_PAGE_SIZE);
        if (topToggle.checked) params.set("topN", String(Math.min(50, Number(topSelect.value) * 2)));
        return params;
    }

    async function search(page) {
        const id = ++requestId;
        const params = page === 0 ? (query = buildQuery()) : query;
        params.set("page", page);
        submitButton.disabled = true;
        moreButton.disabled = true;
        try {
            let current = page;
            let body;
            while (true) {
                params.set("page", current);
                const response = await fetch(`/api/accommodations/search?${params}`);
                body = await response.json().catch(() => ({}));
                if (id !== requestId) return;
                if (response.status === 404) {
                    showMessage("숙소 검색은 DB에 연결된 상태에서만 이용할 수 있습니다.", true);
                    return;
                }
                if (!response.ok) {
                    showMessage(body.message || `검색에 실패했습니다. (HTTP ${response.status})`, true);
                    return;
                }
                if (current === 0) clearEntries();
                addItems(body.items);
                if (topToggle.checked) break;
                // 평일/주말 행이 한 숙소로 합쳐지므로, 한 페이지에 카드가 다 차도록 다음 페이지를 이어서 가져옵니다.
                if (entries.length >= ACCOMMODATION_PAGE_SIZE || !body.hasNext) break;
                current = body.page + 1;
            }
            if (topToggle.checked) trimTo(Number(topSelect.value));
            renumber();
            nextPage = body.page + 1;
            count.textContent = topToggle.checked
                ? `안전한 숙소 상위 ${formatNumber(entries.length)}개`
                : "";
            empty.hidden = body.total > 0;
            moreButton.hidden = !body.hasNext || topToggle.checked;
            message.hidden = true;
            if (page === 0) fitToResults();
            if (page === 0) {
                searchActive = true;
                syncPinRow();
                schedulePins();
            }
        } catch (error) {
            showMessage("숙소 검색은 DB에 연결된 상태에서만 이용할 수 있습니다.", true);
        } finally {
            if (id === requestId) {
                submitButton.disabled = false;
                moreButton.disabled = false;
            }
        }
    }

    function createPinMarker(entry) {
        const item = entry.items[0];
        entry.marker = new google.maps.Marker({
            position: { lat: Number(item.latitude), lng: Number(item.longitude) },
            map: null,
            zIndex: 4,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: "#1971c2",
                fillOpacity: 0.85,
                strokeColor: "#ffffff",
                strokeWeight: 1.5
            }
        });
        entry.marker.addListener("click", () => openInfo(entry));
    }

    function createPinMarker(entry) {
        const item = entry.items[0];
        entry.marker = new google.maps.Marker({
            position: { lat: Number(item.latitude), lng: Number(item.longitude) },
            map: null,
            zIndex: 4,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: "#1971c2",
                fillOpacity: 0.85,
                strokeColor: "#ffffff",
                strokeWeight: 1.5
            }
        });
        entry.marker.addListener("click", () => openInfo(entry));
    }

    function hidePins() {
        pinEntries.forEach(({ marker }) => marker?.setMap(null));
        pinEntries.length = 0;
        pinsByKey.clear();
    }

    function showPins(items) {
        hidePins();
        items.forEach((item) => {
            const key = groupKey(item);
            if (byKey.has(key)) return;
            const existing = pinsByKey.get(key);
            if (existing) {
                existing.items.push(item);
                return;
            }
            const entry = { items: [item], rank: null, marker: null };
            pinsByKey.set(key, entry);
            pinEntries.push(entry);
        });
        pinEntries.forEach((entry) => createPinMarker(entry));
        const markers = pinEntries.map(({ marker }) => marker);
        markers.forEach((marker) => marker.setMap(map));
    }

    async function refreshPins() {
        const id = ++pinRequestId;
        const bounds = map.getBounds();
        if (!menuActive || !searchActive || map.getZoom() < PIN_MIN_ZOOM || !bounds) {
            hidePins();
            return;
        }
        const params = buildQuery();
        ["page", "size", "topN", "safestTop"].forEach((key) => params.delete(key));
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        params.set("minLat", sw.lat());
        params.set("maxLat", ne.lat());
        params.set("minLng", sw.lng());
        params.set("maxLng", ne.lng());
        if (showAllPins) params.set("all", "true");
        try {
            const response = await fetch(`/api/accommodations/pins?${params}`);
            if (!response.ok || id !== pinRequestId) return;
            showPins(await response.json());
        } catch (error) {
            console.error(error);
        }
    }

    function schedulePins() {
        clearTimeout(pinTimer);
        pinTimer = setTimeout(refreshPins, 300);
    }

    function fitRegion() {
        const bounds = new google.maps.LatLngBounds();
        entries.forEach(({ marker }) => bounds.extend(marker.getPosition()));
        if (bounds.isEmpty()) return;
        map.fitBounds(bounds, 40);
        google.maps.event.addListenerOnce(map, "idle", () => {
            if (map.getZoom() < PIN_MIN_ZOOM) map.setZoom(PIN_MIN_ZOOM);
        });
    }

    async function searchRegion() {
        await search(0);
        fitRegion();
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        search(0);
    });
    topToggle.addEventListener("change", syncTopMode);
    resetButton.addEventListener("click", () => {
        form.reset();
        syncTopMode();
        search(0);
    });
    moreButton.addEventListener("click", () => search(nextPage));
    map.addListener("idle", schedulePins);

    window.addEventListener("app:menu", (event) => {
        const active = event.detail.menu === "accommodation";
        menuActive = active;
        syncPinRow();
        entries.forEach(({ marker }) => marker.setMap(active ? map : null));
        schedulePins();
        if (!active) infoWindow.close();
        if (active && firstOpen) {
            firstOpen = false;
            count.textContent = "";
            showMessage("조건을 고르고 검색 버튼을 눌러 주세요.");
        }
    });
    const keywordInput = form.querySelector('[name="keyword"]');
    const keywordLabel = keywordInput.closest("label");
    const row = document.createElement("div");
    row.className = "two";
    const boroughLabel = document.createElement("label");
    const boroughSelect = document.createElement("select");
    boroughLabel.textContent = "자치구";
    boroughSelect.id = "accommodation-borough";
    boroughSelect.append(new Option("전체", ""));
    boroughSelect.addEventListener("change", () => {
        keywordInput.value = boroughSelect.value;
    });
    boroughLabel.append(boroughSelect);
    keywordLabel.replaceWith(row);
    row.append(keywordLabel, boroughLabel);

    async function loadBoroughs() {
        try {
            const response = await fetch("/api/accommodations/boroughs");
            if (!response.ok) return;
            const names = await response.json();
            names.forEach((name) => boroughSelect.append(new Option(name, name)));
        } catch (error) {
            console.error(error);
        }
    }
    loadBoroughs();

    window.addEventListener("accommodation:borough-click", (event) => {
        const borough = event.detail.borough;
        if (![...boroughSelect.options].some((option) => option.value === borough)) {
            showMessage("이 지역에는 등록된 숙소가 없어요.");
            return;
        }
        boroughSelect.value = borough;
        keywordInput.value = borough;
        searchRegion();
    });

    const pinRow = document.createElement("div");
    pinRow.id = "accommodation-pins-row";
    pinRow.style.cssText = "display:none;align-items:center;gap:8px;margin:10px 0 0;padding:6px 8px 6px 12px;border-radius:999px;background:#ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.25);font-size:12px;color:#40505c;";
    const pinNotice = document.createElement("span");
    const pinToggle = document.createElement("button");
    pinToggle.type = "button";
    pinToggle.className = "button secondary";
    pinToggle.style.cssText = "min-height:28px;padding:0 10px;font-size:12px;white-space:nowrap;flex:0 0 auto;";
    function syncPinNotice() {
        pinNotice.textContent = showAllPins
            ? "지도 핀: 화면 안 전체 (최대 1000개)"
            : "지도 핀: 정렬 상위 50개";
        pinToggle.textContent = showAllPins ? "상위 50개만 보기" : "전체 보기";
    }
    pinToggle.addEventListener("click", () => {
        showAllPins = !showAllPins;
        syncPinNotice();
        refreshPins();
    });
    pinRow.append(pinNotice, pinToggle);
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(pinRow);
    function syncPinRow() {
        pinRow.style.display = searchActive && menuActive ? "flex" : "none";
    }
    syncPinNotice();

    syncTopMode();
    submitButton.disabled = false;
}