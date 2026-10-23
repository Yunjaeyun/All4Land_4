/* In-memory drawing workspace. No database or browser storage is used. */
window.CustomLayerDraw = class {
    constructor(map) {
        this.map = map;
        this.defaultDoubleClickZoom = Boolean(map.get("disableDoubleClickZoom"));
        this.mode = "select";
        this.items = [];
        this.layers = [];
        this.filter = null;
        this.editingLayerId = null;
        this.vertices = [];
        this.preview = null;
        this.selected = null;
        this.nextId = 1;
        this.labels = { marker: "마커", polyline: "선", polygon: "다각형", rectangle: "사각형", circle: "원" };
        this.message = document.getElementById("draw-status");
        this.tools = [...document.querySelectorAll("[data-draw-mode]")];
        this.tools.forEach((button) => {
            button.disabled = false;
            button.addEventListener("click", () => this.setMode(button.dataset.drawMode));
        });
        document.getElementById("draw-finish").addEventListener("click", () => this.finish());
        document.getElementById("draw-cancel").addEventListener("click", () => this.setMode("select"));
        document.getElementById("draw-delete").addEventListener("click", () => this.removeSelected());
        document.getElementById("draw-color").addEventListener("input", () => {
            if (this.selected) {
                this.selected.color = this.color();
                this.selected.overlay.setOptions(this.style(this.selected.type, this.color()));
            }
        });
        map.addListener("click", (event) => {
            // The second click of a double-click must not add a second endpoint.
            if (event.domEvent?.detail >= 2 && ["polyline", "polygon"].includes(this.mode)) return;
            this.click(event.latLng);
        });
        map.addListener("dblclick", (event) => this.doubleClick(event));
        map.addListener("mousemove", (event) => this.move(event.latLng));
        window.addEventListener("custom-layer:position", (event) => {
            if (!this.active()) return;
            if (this.vertices.length) {
                this.message.textContent = "그리기를 완료하거나 취소한 뒤 좌표에 마커를 추가하세요.";
                return;
            }
            this.setMode("marker");
            this.add("marker", event.detail);
        });
        window.addEventListener("app:menu", () => this.syncActive());
        window.addEventListener("custom-layer:tab", () => this.syncActive());
        document.addEventListener("keydown", (event) => {
            if (!this.active() || event.target.closest("input, select, textarea")) return;
            if (event.key === "Escape") this.setMode("select");
            if (event.key === "Enter" && this.vertices.length && !event.target.closest("button")) {
                event.preventDefault(); this.finish();
            }
        });
        document.getElementById("layer-add-form").addEventListener("submit", (event) => {
            event.preventDefault();
            this.register();
        });
        document.getElementById("layer-register").disabled = false;
        document.getElementById("layer-query-submit").disabled = false;
        document.getElementById("layer-query-form").addEventListener("submit", (event) => {
            event.preventDefault();
            this.query();
        });
        document.getElementById("layer-query-reset").addEventListener("click", () => {
            this.filter = null;
            document.getElementById("query-month").value = "";
            document.getElementById("query-start").value = "00:00";
            document.getElementById("query-end").value = "23:59";
            this.refresh();
        });
        document.getElementById("layer-edit-form").addEventListener("submit", (event) => {
            event.preventDefault();
            this.saveEdit();
        });
        document.getElementById("layer-edit-cancel").addEventListener("click", () => this.closeEdit());
        this.setMode("select");
        this.refresh();
    }

    active() {
        return document.body.dataset.activeMenu === "custom-layer" && !document.getElementById("layer-add").hidden;
    }
    color() { return document.getElementById("draw-color").value; }
    style(type, color) {
        return type === "marker" ? { icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color,
            fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 } }
            : { strokeColor: color, strokeWeight: 3, fillColor: color, fillOpacity: 0.25 };
    }
    make(type, geometry, color) {
        const options = { ...this.style(type, color), map: this.map, zIndex: 100 };
        if (type === "marker") return new google.maps.Marker({ ...options, position: geometry });
        if (type === "polyline") return new google.maps.Polyline({ ...options, path: geometry });
        if (type === "polygon") return new google.maps.Polygon({ ...options, paths: geometry });
        if (type === "rectangle") return new google.maps.Rectangle({ ...options, bounds: geometry });
        return new google.maps.Circle({ ...options, center: geometry.center, radius: geometry.radius });
    }
    clearPreview() {
        this.preview?.setMap(null);
        this.preview = null;
        this.vertices = [];
    }
    setMode(mode) {
        this.clearPreview();
        this.select(null);
        this.mode = mode;
        this.tools.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.drawMode === mode)));
        this.map.setOptions({
            draggableCursor: mode === "select" ? null : "crosshair",
            disableDoubleClickZoom: ["polyline", "polygon"].includes(mode) ? true : this.defaultDoubleClickZoom
        });
        this.items.forEach((item) => item.overlay.setOptions({ clickable: mode === "select" }));
        this.message.textContent = mode === "select" ? "도형을 선택하면 이동·크기를 편집할 수 있습니다."
            : mode === "marker" ? "지도 클릭으로 마커를 추가합니다. 좌표 입력 후 ‘좌표에 마커 추가’도 사용할 수 있습니다."
            : ["rectangle", "circle"].includes(mode) ? "첫 지점과 끝 지점을 차례로 클릭하세요. Esc로 취소합니다."
            : "지점을 차례로 클릭한 뒤 ‘그리기 완료’ 또는 지도 더블클릭으로 완료하세요. Esc로 취소합니다.";
        this.updateActions();
    }
    syncActive() {
        if (!this.active()) this.setMode("select");
        this.items.forEach((item) => item.overlay.setOptions({ clickable: this.active() && this.mode === "select" }));
        this.refresh();
    }
    select(item) {
        if (this.selected) this.selected.overlay.setOptions({ editable: false, draggable: false });
        this.selected = item;
        const layer = this.layers.find((entry) => entry.id === item?.layerId);
        document.getElementById("layer-details").hidden = !layer;
        if (layer) {
            document.getElementById("layer-details-title").textContent = layer.name;
            document.getElementById("layer-details-meta").textContent = `${layer.month}월 ${layer.time}`;
            const photo = document.getElementById("layer-details-photo");
            photo.hidden = !layer.photoUrl;
            if (layer.photoUrl) photo.src = layer.photoUrl;
            else photo.removeAttribute("src");
        }
        if (item && this.active()) {
            item.overlay.setOptions({ editable: item.type !== "marker", draggable: true });
            document.getElementById("draw-color").value = item.color;
            this.message.textContent = `${this.labels[item.type]} 선택됨 · 드래그로 이동하거나 조절점을 움직이세요.`;
        }
        this.updateActions();
    }
    updateActions() {
        document.getElementById("draw-delete").disabled = !this.selected;
        document.getElementById("draw-cancel").disabled = this.mode === "select";
        const minimum = this.mode === "polygon" ? 3 : 2;
        document.getElementById("draw-finish").disabled = !["polygon", "polyline"].includes(this.mode) || this.vertices.length < minimum;
        const count = this.items.filter((item) => !item.layerId).length;
        document.getElementById("draw-count").textContent = `등록 대기 도형 ${count}개`;
    }
    click(latLng) {
        if (!this.active() || this.mode === "select") return;
        const point = latLng.toJSON();
        if (this.mode === "marker") {
            window.dispatchEvent(new CustomEvent("custom-layer:map-click", { detail: point }));
            this.add("marker", point);
            return;
        }
        const last = this.vertices.at(-1);
        if (last && last.lat === point.lat && last.lng === point.lng) return;
        this.vertices.push(point);
        if (["rectangle", "circle"].includes(this.mode) && this.vertices.length === 2) this.finish();
        else { this.move(latLng); this.updateActions(); }
    }
    doubleClick(event) {
        if (!this.active() || !["polyline", "polygon"].includes(this.mode)) return;
        event.stop?.();
        event.domEvent?.preventDefault();
        // Google Maps normally emits a click first; click() deduplicates that endpoint.
        this.click(event.latLng);
        const minimum = this.mode === "polygon" ? 3 : 2;
        if (this.vertices.length < minimum) {
            this.message.textContent = `완료하려면 서로 다른 지점을 ${minimum}개 이상 지정하세요.`;
            return;
        }
        this.finish();
    }
    geometry(type, points) {
        if (type === "rectangle") return { north: Math.max(points[0].lat, points[1].lat),
            south: Math.min(points[0].lat, points[1].lat), east: Math.max(points[0].lng, points[1].lng), west: Math.min(points[0].lng, points[1].lng) };
        if (type === "circle") {
            const radians = (value) => value * Math.PI / 180;
            const a = points[0], b = points[1];
            const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
            return { center: a, radius: 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h))) };
        }
        return points;
    }
    move(latLng) {
        if (!this.active() || !this.vertices.length) return;
        const points = [...this.vertices, latLng.toJSON()];
        const type = this.mode;
        this.preview?.setMap(null);
        this.preview = this.make(type, this.geometry(type, points), this.color());
        this.preview.setOptions({ clickable: false, strokeOpacity: 0.65 });
    }
    finish() {
        const type = this.mode;
        if (!["polyline", "polygon", "rectangle", "circle"].includes(type)) return;
        if (this.vertices.length < (type === "polygon" ? 3 : 2)) return;
        if (type === "rectangle" && (this.vertices[0].lat === this.vertices[1].lat || this.vertices[0].lng === this.vertices[1].lng)) {
            this.message.textContent = "너비와 높이가 있는 사각형을 그려주세요.";
            this.clearPreview();
            this.updateActions();
            return;
        }
        const geometry = this.geometry(type, [...this.vertices]);
        this.clearPreview();
        this.add(type, geometry);
        this.setMode("select");
        this.select(this.items.at(-1));
    }
    add(type, geometry) {
        const item = { id: this.nextId++, type, color: this.color(), layerId: null };
        item.overlay = this.make(type, geometry, item.color);
        item.overlay.setOptions({ clickable: this.mode === "select" });
        item.overlay.addListener("click", () => {
            if (this.active() && this.mode === "select") this.select(item);
        });
        this.items.push(item);
        this.message.textContent = `${this.labels[type]} 추가됨 · 도형을 더 그리거나 레이어를 등록하세요.`;
        this.updateActions();
    }
    removeSelected() {
        if (!this.selected) return;
        const item = this.selected;
        this.select(null);
        item.overlay.setMap(null);
        google.maps.event.clearInstanceListeners(item.overlay);
        this.items = this.items.filter((entry) => entry !== item);
        const emptyLayers = this.layers.filter((layer) => !this.items.some((entry) => entry.layerId === layer.id));
        emptyLayers.forEach((layer) => this.deleteLayer(layer.id));
        this.refresh();
        this.updateActions();
    }
    register() {
        const name = document.getElementById("layer-name").value.trim();
        const month = Number(document.getElementById("layer-month").value);
        const time = document.getElementById("layer-time").value;
        if (this.vertices.length) { this.message.textContent = "진행 중인 그리기를 완료하거나 취소하세요."; return; }
        const drafts = this.items.filter((item) => !item.layerId);
        if (!name || !time || !month || !drafts.length) {
            this.message.textContent = "이름·월·시간을 입력하고 도형을 하나 이상 그려주세요.";
            return;
        }
        if (!this.validMetadata(name, month, time)) return;
        const file = document.getElementById("layer-photo").files?.[0];
        if (!this.validPhoto(file)) return;
        const layer = { id: this.nextId++, name, month, time, visible: true,
            photoUrl: file ? URL.createObjectURL(file) : null };
        drafts.forEach((item) => { item.layerId = layer.id; });
        this.layers.push(layer);
        this.setMode("select");
        this.refresh();
        document.getElementById("layer-name").value = "";
        document.getElementById("layer-photo").value = "";
        window.dispatchEvent(new CustomEvent("custom-layer:photo-reset"));
        this.message.textContent = `‘${name}’ 레이어에 도형 ${drafts.length}개를 등록했습니다. 현재 화면에서만 유지됩니다.`;
        this.updateActions();
    }
    renderLayers() {
        const list = document.getElementById("draw-layers");
        list.replaceChildren();
        const layers = this.layers.filter((layer) => this.matches(layer));
        if (!layers.length) {
            const empty = document.createElement("li");
            empty.className = "layer-hint";
            empty.textContent = this.layers.length ? "조건에 맞는 레이어가 없습니다." : "등록한 레이어가 없습니다. 도형을 그려 등록하세요.";
            list.append(empty);
        }
        layers.forEach((layer) => {
            const row = document.createElement("li");
            const button = document.createElement("button");
            const items = this.items.filter((item) => item.layerId === layer.id);
            button.type = "button";
            button.textContent = `${layer.name} · ${layer.month}월 ${layer.time} · 도형 ${items.length}개`;
            button.addEventListener("click", () => {
                if (!layer.visible) layer.visible = true;
                this.setMode("select");
                this.select(items[0]);
                this.refresh();
                const overlay = items[0].overlay;
                if (items[0].type === "marker") this.map.panTo(overlay.getPosition());
                else if (items[0].type === "circle" || items[0].type === "rectangle") this.map.fitBounds(overlay.getBounds());
                else {
                    const bounds = new google.maps.LatLngBounds();
                    overlay.getPath().forEach((point) => bounds.extend(point));
                    this.map.fitBounds(bounds);
                }
            });
            row.append(button);
            const actions = document.createElement("div");
            actions.className = "layer-row-actions";
            const action = (label, callback) => {
                const control = document.createElement("button");
                control.type = "button";
                control.textContent = label;
                control.setAttribute("aria-label", `${layer.name} ${label}`);
                control.addEventListener("click", callback);
                actions.append(control);
                return control;
            };
            const visibility = action(layer.visible ? "숨기기" : "표시", () => this.toggleLayer(layer.id));
            visibility.setAttribute("aria-pressed", String(layer.visible));
            action("정보 수정", () => this.editLayer(layer.id));
            action("레이어 삭제", () => this.deleteLayer(layer.id));
            row.append(actions);
            list.append(row);
        });
    }
    validMetadata(name, month, time) {
        if (!name || name.length > 100 || !Number.isInteger(month) || month < 1 || month > 12 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
            this.message.textContent = "이름(1~100자), 월(1~12월), 시간을 확인하세요.";
            return false;
        }
        return true;
    }
    validPhoto(file) {
        if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
            const text = "5MB 이하의 JPG, PNG, WebP 사진을 선택하세요.";
            this.message.textContent = text;
            document.getElementById("layer-edit-status").textContent = text;
            return false;
        }
        return true;
    }
    matches(layer) {
        if (document.body.dataset.activeMenu !== "custom-layer" || document.getElementById("layer-query").hidden || !this.filter) return true;
        const { month, start, end } = this.filter;
        return (!month || layer.month === month) && (start <= end
            ? layer.time >= start && layer.time <= end : layer.time >= start || layer.time <= end);
    }
    refresh() {
        this.items.forEach((item) => {
            const layer = this.layers.find((entry) => entry.id === item.layerId);
            const shown = layer ? layer.visible && this.matches(layer)
                : document.body.dataset.activeMenu === "custom-layer" && !document.getElementById("layer-add").hidden;
            if (!shown && this.selected === item) this.select(null);
            item.overlay.setMap(shown ? this.map : null);
        });
        this.renderLayers();
        const matches = this.layers.filter((layer) => this.matches(layer));
        document.getElementById("layer-query-status").textContent = `전체 ${this.layers.length}개 중 ${matches.length}개 일치 · 지도 표시 ${matches.filter((layer) => layer.visible).length}개`;
    }
    query() {
        const month = Number(document.getElementById("query-month").value);
        const start = document.getElementById("query-start").value;
        const end = document.getElementById("query-end").value;
        const time = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (!time.test(start) || !time.test(end) || !Number.isInteger(month) || month < 0 || month > 12) {
            document.getElementById("layer-query-status").textContent = "월과 시작·종료 시간을 확인하세요.";
            return;
        }
        this.filter = { month, start, end };
        this.select(null);
        this.refresh();
    }
    toggleLayer(id) {
        const layer = this.layers.find((entry) => entry.id === id);
        if (!layer) return;
        layer.visible = !layer.visible;
        this.refresh();
    }
    deleteLayer(id) {
        const layer = this.layers.find((entry) => entry.id === id);
        if (!layer) return;
        if (this.selected?.layerId === id) this.select(null);
        this.items.filter((item) => item.layerId === id).forEach((item) => {
            item.overlay.setMap(null);
            google.maps.event.clearInstanceListeners(item.overlay);
        });
        this.items = this.items.filter((item) => item.layerId !== id);
        this.layers = this.layers.filter((entry) => entry.id !== id);
        if (layer.photoUrl) URL.revokeObjectURL(layer.photoUrl);
        if (this.editingLayerId === id) this.closeEdit();
        this.refresh();
        this.updateActions();
    }
    closeEdit() {
        this.editingLayerId = null;
        document.getElementById("layer-edit-form").hidden = true;
    }
    editLayer(id) {
        const layer = this.layers.find((entry) => entry.id === id);
        if (!layer) return;
        this.editingLayerId = id;
        document.getElementById("edit-layer-name").value = layer.name;
        document.getElementById("edit-layer-month").value = String(layer.month);
        document.getElementById("edit-layer-time").value = layer.time;
        document.getElementById("edit-layer-photo").value = "";
        document.getElementById("edit-remove-photo").checked = false;
        document.getElementById("layer-edit-status").textContent = "사진을 선택하면 기존 사진을 교체합니다.";
        document.getElementById("layer-edit-form").hidden = false;
        document.getElementById("edit-layer-name").focus();
    }
    saveEdit() {
        const layer = this.layers.find((entry) => entry.id === this.editingLayerId);
        if (!layer) return;
        const name = document.getElementById("edit-layer-name").value.trim();
        const month = Number(document.getElementById("edit-layer-month").value);
        const time = document.getElementById("edit-layer-time").value;
        if (!this.validMetadata(name, month, time)) {
            document.getElementById("layer-edit-status").textContent = this.message.textContent;
            return;
        }
        const file = document.getElementById("edit-layer-photo").files?.[0];
        if (!this.validPhoto(file)) return;
        const remove = document.getElementById("edit-remove-photo").checked;
        if (file || remove) {
            if (layer.photoUrl) URL.revokeObjectURL(layer.photoUrl);
            layer.photoUrl = file ? URL.createObjectURL(file) : null;
        }
        Object.assign(layer, { name, month, time });
        if (this.selected?.layerId === layer.id) this.select(this.selected);
        this.closeEdit();
        this.refresh();
        this.message.textContent = "레이어 정보를 수정했습니다.";
    }
};
