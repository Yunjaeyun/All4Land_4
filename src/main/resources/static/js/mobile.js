/* 모바일(720px 이하)에서 패널을 하단 시트로 쓰기 위한 동작. 데스크톱에서는 손잡이와 탭이 숨겨져 아무 영향이 없다. */
(() => {
    const mobile = window.matchMedia("(max-width: 720px)");
    const panels = [...document.querySelectorAll("aside.map-panel")];

    function setCollapsed(panel, collapsed) {
        if (!panel) return;
        panel.classList.toggle("is-collapsed", collapsed);
        const handle = panel.querySelector(":scope > .sheet-handle");
        handle.setAttribute("aria-expanded", String(!collapsed));
        handle.setAttribute("aria-label", collapsed ? "패널 펼치기" : "패널 접기");
        if (!collapsed) panel.scrollTop = 0;
    }

    // 손잡이: 탭하면 접기/펼치기를 바꾸고, 아래로 끌면 접고 위로 끌면 펼친다
    const DRAG_THRESHOLD = 24;
    panels.forEach((panel) => {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "sheet-handle";
        let startY = null;
        let dragged = false;
        handle.addEventListener("pointerdown", (event) => {
            startY = event.clientY;
            dragged = false;
            handle.setPointerCapture(event.pointerId);
        });
        handle.addEventListener("pointermove", (event) => {
            if (startY === null) return;
            const dy = event.clientY - startY;
            if (Math.abs(dy) < DRAG_THRESHOLD) return;
            dragged = true;
            setCollapsed(panel, dy > 0);
            startY = null;
        });
        const endDrag = () => { startY = null; };
        handle.addEventListener("pointerup", endDrag);
        handle.addEventListener("pointercancel", endDrag);
        handle.addEventListener("click", () => {
            if (dragged) { dragged = false; return; }
            setCollapsed(panel, !panel.classList.contains("is-collapsed"));
        });
        panel.prepend(handle);
        setCollapsed(panel, false);
    });

    // 숙소 찾기: 조건 패널과 결과 패널을 탭 하나로 전환한다
    const accPanel = document.getElementById("accommodation-panel");
    const accResults = document.getElementById("accommodation-results");
    const accCount = document.getElementById("accommodation-count");
    const switches = [];
    function setAccView(view) {
        document.body.dataset.accView = view;
        switches.forEach(({ form, results }) => {
            form.setAttribute("aria-pressed", String(view === "form"));
            results.setAttribute("aria-pressed", String(view === "results"));
        });
        setCollapsed(view === "results" ? accResults : accPanel, false);
    }
    function syncResultLabel() {
        switches.forEach(({ results }) => { results.textContent = `결과 ${accCount ? accCount.textContent : ""}`.trim(); });
    }
    [accPanel, accResults].forEach((panel) => {
        if (!panel) return;
        const box = document.createElement("div");
        box.className = "acc-switch";
        box.setAttribute("role", "group");
        box.setAttribute("aria-label", "숙소 찾기 화면");
        const form = document.createElement("button");
        const results = document.createElement("button");
        form.type = results.type = "button";
        form.textContent = "조건";
        form.addEventListener("click", () => setAccView("form"));
        results.addEventListener("click", () => setAccView("results"));
        box.append(form, results);
        panel.querySelector(":scope > .sheet-handle").after(box);
        switches.push({ form, results });
    });
    setAccView("form");
    syncResultLabel();

    // 사용자가 검색했을 때만 결과 탭으로 넘어간다 (처음 불러올 때는 조건 탭 유지)
    let openResults = false;
    accPanel?.addEventListener("submit", () => { openResults = true; });
    accPanel?.addEventListener("click", (event) => {
        if (event.target.closest(".borough-chip, #accommodation-reset")) openResults = true;
    });
    if (accCount) {
        new MutationObserver(() => {
            syncResultLabel();
            if (openResults && mobile.matches) setAccView("results");
            openResults = false;
        }).observe(accCount, { childList: true, characterData: true, subtree: true });
    }

    // 목록에서 항목을 고르면 지도와 정보창이 보이도록 시트를 접는다
    document.addEventListener("click", (event) => {
        if (!mobile.matches) return;
        const item = event.target.closest(".accommodation-item, .restaurant-item");
        if (item) setCollapsed(item.closest("aside.map-panel"), true);
    });

    // 맛집 추가: 위치를 고르는 동안 시트를 접고, 입력 폼이 열리면 다시 펼친다
    const restaurantPanel = document.getElementById("restaurant-panel");
    const restaurantForm = document.getElementById("restaurant-form");
    document.getElementById("restaurant-add")?.addEventListener("click", () => {
        if (mobile.matches) setCollapsed(restaurantPanel, true);
    });
    if (restaurantForm) {
        new MutationObserver(() => {
            if (!restaurantForm.hidden) setCollapsed(restaurantPanel, false);
        }).observe(restaurantForm, { attributes: true, attributeFilter: ["hidden"] });
    }

    // 메뉴를 바꾸면 새 패널은 펼친 상태로 시작한다
    window.addEventListener("app:menu", () => {
        panels.forEach((panel) => setCollapsed(panel, false));
        setAccView("form");
    });
})();
