/* 숙소 검색: 조건 검색(/api/accommodations/search) 결과를 목록과 지도 마커로 보여준다 */
const ACCOMMODATION_SAFETY_LABELS = ["매우 안전", "안전", "보통", "주의", "위험"];
const ACCOMMODATION_ROOM_LABELS = { ENTIRE_HOME: "전체 집", PRIVATE_ROOM: "개인실", SHARED_ROOM: "공용실" };
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
    function summaryText(item) {
        return [
            `총가격 ${formatNumber(item.priceTotal, 2)}`,
            `${item.maxGuests}인`,
 		item.safetyLevel ? `치안 ${safetyLabel(item.safetyLevel)}` : null,
            item.satisfactionScore ? `만족도 ${formatNumber(item.satisfactionScore)}` : null
        ].filter(Boolean).join(" · ");
    }

    function infoContent(item) {
        const box = document.createElement("div");
        const title = document.createElement("strong");
        box.className = "accommodation-info";
          title.textContent = item.rank ? `${item.rank}. ${item.name}` : item.name;
        box.append(title);
        [
            `${ACCOMMODATION_ROOM_LABELS[item.roomType]} · 침실 ${item.bedrooms}개 · 최대 ${item.maxGuests}인${item.isSuperhost ? " · 슈퍼호스트" : ""}`,
            `총가격 ${formatNumber(item.priceTotal, 2)} (${item.dayType === "weekend" ? "주말" : "평일"} 기준)`,
            `청결 ${formatNumber(item.cleanlinessScore, 1)} · 만족도 ${formatNumber(item.satisfactionScore)}`,
            `시내 ${formatNumber(item.distanceCityCenterKm, 1)}km · 지하철 ${formatNumber(item.distanceMetroKm, 1)}km`,
            item.lsoaName ? `${item.lsoaName} · 치안 ${item.safetyLevel}등급 (${ACCOMMODATION_SAFETY_LABELS[item.safetyLevel - 1]})` : null
        ].filter(Boolean).forEach((line) => {
            const row = document.createElement("div");
            row.textContent = line;
            box.append(row);
        });
        return box;
    }

    function openInfo(entry) {
        infoWindow.setContent(infoContent(entry.item));
        infoWindow.open({ map, anchor: entry.marker });
    }

    function addEntry(item) {
        const marker = new google.maps.Marker({
            position: { lat: Number(item.latitude), lng: Number(item.longitude) },
            map,
            title: item.name,
            zIndex: 8,
  label: item.rank ? { text: String(item.rank), color: "#ffffff", fontSize: "11px", fontWeight: "700" } : undefined,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: "#1971c2",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
            }
        });
        const entry = { item, marker };
        const li = document.createElement("li");
        const button = document.createElement("button");
        const name = document.createElement("strong");
        const sub = document.createElement("span");
        button.type = "button";
        button.className = "accommodation-item";
         name.textContent = item.rank ? `${item.rank}. ${item.name}` : item.name;
        sub.textContent = summaryText(item);
        button.append(name, sub);
        button.addEventListener("click", () => {
            map.panTo(marker.getPosition());
            if (map.getZoom() < 14) map.setZoom(14);
            openInfo(entry);
        });
        marker.addListener("click", () => openInfo(entry));
        li.append(button);
        list.append(li);
        entry.li = li;
        entries.push(entry);
    }

    function clearEntries() {
        infoWindow.close();
        entries.forEach(({ marker, li }) => { marker.setMap(null); li.remove(); });
        entries.length = 0;
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
            // 더 늦게 보낸 검색이 있으면 이 응답은 버린다
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
            body.items.forEach(addEntry);
            nextPage = body.page + 1;
             count.textContent = topToggle.checked
                ? `안전한 숙소 상위 ${formatNumber(entries.length)}개`
                : `${formatNumber(body.total)}건 중 ${formatNumber(entries.length)}건 표시`;
            empty.hidden = body.total > 0;
            moreButton.hidden = !body.hasNext;
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

    // 숙소 검색 메뉴에서만 마커를 보이고, 처음 열 때 기본 조건으로 한 번 검색한다
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
