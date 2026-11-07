/* Read-only analysis of the current registered, visible query result. Photos are never transmitted. */
window.CustomLayerRanking = class {
    constructor(draw, storage, map, showBorough = () => {}) {
        this.draw = draw;
        this.storage = storage;
        this.map = map;
        this.showBorough = showBorough;
        this.revision = 0;
        this.busy = false;
        this.exampleOverlays = new Map();
        this.button = document.getElementById("personal-ranking-run");
        this.exampleButton = document.getElementById("personal-ranking-example");
        this.exampleData = document.getElementById("personal-ranking-example-data");
        this.exampleItems = document.getElementById("personal-ranking-example-items");
        this.order = document.getElementById("personal-ranking-order");
        this.status = document.getElementById("personal-ranking-status");
        this.list = document.getElementById("personal-ranking-results");
        this.button.addEventListener("click", () => this.run());
        this.exampleButton.addEventListener("click", () => this.run(true));
        this.order.addEventListener("change", () => this.invalidate());
        window.addEventListener("custom-layer:change", () => this.invalidate());
        window.addEventListener("custom-layer:tab", () => this.invalidate());
        window.addEventListener("app:menu", () => this.invalidate());
    }
    clearExample() {
        this.exampleOverlays.forEach(overlay => overlay.setMap(null));
        this.exampleOverlays.clear();
        this.exampleData.hidden = true;
    }
    invalidate() {
        this.revision++;
        this.showBorough(null);
        this.list.replaceChildren();
        this.clearExample();
        this.status.textContent = "장소·도형 또는 조건이 변경되었습니다. 순위를 다시 계산하세요.";
        this.button.disabled = this.busy || this.storage.busy;
        this.exampleButton.disabled = this.busy || this.storage.busy;
    }
    payload() {
        return { features: this.draw.items.filter(item => item.registered && item.visible && this.draw.matches(item))
            .map(item => ({ id: item.id, name: item.name, month: item.month, time: item.time,
                visible: true, photo: null, shape: this.storage.shape(item) })) };
    }
    async run(example = false) {
        if (this.busy || this.storage.busy) return;
        this.showBorough(null);
        this.list.replaceChildren();
        this.clearExample();
        if (!example && (this.draw.vertices.length || this.draw.items.some(item => !item.registered))) {
            this.status.textContent = "그리는 중인 도형을 완료하고 등록하거나 삭제한 뒤 계산하세요.";
            return;
        }
        let payload;
        try { payload = example ? null : this.payload(); }
        catch {
            this.status.textContent = "지도에서 도형 좌표를 읽지 못했습니다. Google 지도 연결 상태를 확인하고 다시 시도하세요.";
            return;
        }
        if (!example && !payload.features.length) {
            this.status.textContent = "집계할 장소·도형이 없습니다. 항목을 등록하고 조회 조건과 표시 여부를 확인하세요.";
            return;
        }
        const revision = ++this.revision;
        this.busy = true;
        this.button.disabled = true;
        this.exampleButton.disabled = true;
        this.status.textContent = "기존 행정구역과 장소·도형을 비교하는 중…";
        try {
            if (example) {
                const data = await fetch("/data/personal-ranking-example.json", { cache: "no-store" });
                if (!data.ok) throw new Error("예시 데이터를 불러오지 못했습니다. 다시 시도하세요.");
                payload = await data.json();
                if (revision !== this.revision) return;
            }
            const response = await fetch(`/api/custom-layers/ranking?order=${encodeURIComponent(this.order.value)}`, {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(response.status === 400
                ? "도형 좌표를 확인하세요. 교차하는 다각형이나 길이·면적이 없는 도형은 집계할 수 없습니다."
                : "순위를 계산하지 못했습니다. 서버 연결을 확인하고 다시 시도하세요.");
            const result = await response.json();
            if (revision !== this.revision) return;
            this.render(result, payload.features, example);
            if (example) {
                this.exampleItems.replaceChildren();
                payload.features.forEach(feature => this.exampleItems.append(this.featureRow(feature, true)));
                this.exampleData.hidden = false;
                this.showExample(payload.features);
            }
        } catch (error) {
            if (revision === this.revision) this.status.textContent = error.message;
        } finally {
            this.busy = false;
            this.button.disabled = this.storage.busy;
            this.exampleButton.disabled = this.storage.busy;
        }
    }
    showExample(features) {
        try {
            for (const { id, shape } of features) {
                const geometry = shape.type === "marker" ? shape.position : shape.type === "circle"
                    ? { center: shape.position, radius: shape.radius } : shape.type === "rectangle" ? shape.bounds : shape.path;
                this.exampleOverlays.set(id, this.draw.make(shape.type, geometry, shape.color, {
                    clickable: false, zIndex: 110
                }));
            }
        } catch {
            this.exampleOverlays.forEach(overlay => overlay.setMap(null));
            this.exampleOverlays.clear();
            this.status.textContent += " 예시 도형을 지도에 표시하지 못했습니다.";
        }
    }
    featureRow(feature, example) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${feature.name} · ${this.draw.labels[feature.shape.type]} · ${feature.month}월 ${feature.time}`;
        button.addEventListener("click", () => {
            const target = example
                ? { type: feature.shape.type, overlay: this.exampleOverlays.get(feature.id) }
                : this.draw.items.find(item => item.id === feature.id && item.registered && item.visible);
            if (target?.overlay) this.draw.focusItems([target]);
        });
        item.append(button);
        return item;
    }
    render(result, features, example = false) {
        const featuresById = new Map(features.map(feature => [feature.id, feature]));
        const order = result.order === "safety" ? "사건률 낮은 순" : "관심 장소 많은 순";
        const filter = example ? null : this.draw.filter;
        const criteria = example ? "더미 데이터 예시 · 내 항목 제외 · 조회 조건 미적용" : filter ? `${filter.month ? `${filter.month}월` : "전체 월"} ${filter.start}~${filter.end}` : "전체 월·전체 시간";
        this.status.textContent = `${criteria} · ${order} · ${result.analyzedCount}개 집계 · 지역 내 ${result.matchedCount}개 · 지역 밖 ${result.outsideCount}개 · ${result.regions.length}개 지역. 여러 지역에 걸친 항목은 각 지역에 포함됩니다.`;
        if (!result.regions.length) this.status.textContent += " 기존 런던 행정구역과 겹치는 항목이 없습니다.";
        result.regions.forEach(entry => {
            const row = document.createElement("li");
            const button = document.createElement("button");
            const title = document.createElement("strong");
            const detail = document.createElement("span");
            button.type = "button";
            button.setAttribute("aria-pressed", "false");
            title.textContent = `${entry.rank}. ${entry.borough} · ${entry.count}개`;
            const rate = entry.incidentRate == null ? "정보 없음" : `${Number(entry.incidentRate).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}건 / 1,000명`;
            detail.textContent = `연간 사건률 ${rate} · 지도에서 보기`;
            button.append(title, detail);
            button.addEventListener("click", () => {
                this.list.querySelectorAll("button[aria-pressed]").forEach(control => control.setAttribute("aria-pressed", String(control === button)));
                this.showBorough(entry.borough);
                this.map.fitBounds(entry.bounds, 40);
            });
            row.append(button);
            if (entry.featureIds?.length) {
                const included = document.createElement("details");
                included.className = "layer-more";
                const toggle = document.createElement("summary");
                toggle.textContent = `포함된 장소·도형 ${entry.count}개 보기`;
                const items = document.createElement("ul");
                for (const id of entry.featureIds) {
                    const feature = featuresById.get(id);
                    if (!feature) continue;
                    items.append(this.featureRow(feature, example));
                }
                included.append(toggle, items);
                row.append(included);
            }
            this.list.append(row);
        });
    }
};
