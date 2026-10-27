/* 숙소 검색: 조건 검색(/api/accommodations/search) 결과를 목록과 지도 마커로 보여준다.
   원본 데이터는 같은 숙소가 평일·주말 두 행으로 들어 있다. 좌표·방 유형·인원·침실이 같고
   요일이 서로 다른 행이 짝을 이루면 한 카드로 묶고, 짝이 없는 행은 그 요일만 보이는 카드로 둔다. */
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
    const infoWindow = new google.maps.InfoWindow();
    const entries = [];
    const byKey = new Map();
    let query = null;
    let nextPage = 0;
    let requestId = 0;
    let firstOpen = true;

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
        return item ? formatNumber(item.priceTotal, 2) : null;
    }


    function priceLine(entry) {
        return Object.keys(ACCOMMODATION_DAY_LABELS)
            .filter((day) => dayPrice(entry, day) !== null)
            .map((day) => `${ACCOMMODATION_DAY_LABELS[day]} ${dayPrice(entry, day)}`)
            .join(" / ");
    }

    function displayName(entry) {
        const name = entry.items[0].name;
        return entry.rank ? `${entry.rank}. ${name}` : name;
    }

    function summaryText(entry) {
        const base = entry.items[0];
        return [
            `총가격 ${priceLine(entry)}`,
            `${base.maxGuests}인`,
            base.safetyLevel ? `치안 ${safetyLabel(base.safetyLevel)}` : null,
            base.satisfactionScore ? `만족도 ${formatNumber(base.satisfactionScore)}` : null
        ].filter(Boolean).join(" · ");
    }

    function infoContent(entry) {
        const base = entry.items[0];
        const box = document.createElement("div");
        const title = document.createElement("strong");
        box.className = "accommodation-info";
        title.textContent = displayName(entry);
        box.append(title);
        [
            `${ACCOMMODATION_ROOM_LABELS[base.roomType]} · 침실 ${base.bedrooms}개 · 최대 ${base.maxGuests}인${base.isSuperhost ? " · 슈퍼호스트" : ""}`,
            ...Object.keys(ACCOMMODATION_DAY_LABELS)
                .filter((day) => dayPrice(entry, day) !== null)
                .map((day) => `${ACCOMMODATION_DAY_LABELS[day]} 기준 총가격 ${dayPrice(entry, day)}`),
            `청결 ${formatNumber(base.cleanlinessScore, 1)} · 만족도 ${formatNumber(base.satisfactionScore)}`,
            `시내 ${formatNumber(base.distanceCityCenterKm, 1)}km · 지하철 ${formatNumber(base.distanceMetroKm, 1)}km`,
            base.lsoaName ? `${base.lsoaName} · 치안 ${base.safetyLevel}등급 (${safetyLabel(base.safetyLevel)})` : null
        ].filter(Boolean).forEach((line) => {
            const row = document.createElement("div");
            row.textContent = line;
            box.append(row);
        });
        return box;
    }

    function openInfo(entry) {
        infoWindow.setContent(infoContent(entry));
        infoWindow.open({ map, anchor: entry.marker });
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
        entry.name = document.createElement("strong");
        entry.sub = document.createElement("span");
        button.type = "button";
        button.className = "accommodation-item";
        button.append(entry.name, entry.sub);
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
        entry.name.textContent = displayName(entry);
        entry.sub.textContent = summaryText(entry);
        entry.marker.setTitle?.(displayName(entry));
    }


    function attachItem(item) {
        const key = groupKey(item);
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
            const response = await fetch(`/api/accommodations/search?${params}`);
            const body = await response.json().catch(() => ({}));

            if (id !== requestId) return;
            if (response.status === 404) {
                showMessage("숙소 검색은 DB에 연결된 상태에서만 이용할 수 있습니다.", true);
                return;
            }
            if (!response.ok) {
                showMessage(body.message || `검색에 실패했습니다. (HTTP ${response.status})`, true);
                return;
            }
            if (page === 0) clearEntries();
            addItems(body.items);
            if (topToggle.checked) trimTo(Number(topSelect.value));
  renumber();
            nextPage = body.page + 1;
            count.textContent = topToggle.checked
                ? `안전한 숙소 상위 ${formatNumber(entries.length)}개`
                : `${formatNumber(entries.length)}개 숙소 표시 (검색 결과 ${formatNumber(body.total)}행)`;
            empty.hidden = body.total > 0;
            moreButton.hidden = !body.hasNext || topToggle.checked;
            message.hidden = true;
            if (page === 0) fitToResults();
        } catch (error) {
            showMessage("숙소 검색은 DB에 연결된 상태에서만 이용할 수 있습니다.", true);
        } finally {
            if (id === requestId) {
                submitButton.disabled = false;
                moreButton.disabled = false;
            }
        }
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

    window.addEventListener("app:menu", (event) => {
        const active = event.detail.menu === "accommodation";
        entries.forEach(({ marker }) => marker.setMap(active ? map : null));
        if (!active) infoWindow.close();
        if (active && firstOpen) {
            firstOpen = false;
            search(0);
        }
    });
    syncTopMode();
    submitButton.disabled = false;
}