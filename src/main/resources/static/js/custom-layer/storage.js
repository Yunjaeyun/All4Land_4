/* Explicit server save/load. LayerRepository can later be backed by a database. */
window.CustomLayerStorage = class {
    constructor(draw) {
        this.draw = draw;
        this.loaded = false;
        this.busy = false;
        this.status = document.getElementById("layer-storage-status");
        this.saveButton = document.getElementById("layer-server-save");
        this.saveButton.addEventListener("click", () => this.save());
        this.draw.persistRegistration = item => this.save(item);
        this.load();
    }
    setBusy(busy) {
        this.busy = busy;
        this.saveButton.disabled = busy || !this.loaded;
        document.getElementById("layer-register").disabled = busy || !this.loaded;
        // Avoid editing a registered geometry while a snapshot is being saved/restored.
        document.getElementById("layer-add-form").inert = busy;
        document.getElementById("layer-edit-form").inert = busy;
        document.getElementById("draw-layers").inert = busy;
        this.draw.storageBusy = busy;
        this.draw.syncActive();
    }
    async request(method, body) {
        const response = await fetch("/api/custom-layers", {
            method, credentials: "same-origin", cache: "no-store",
            headers: { "Accept": "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        if (response.status === 401) throw new Error("로그인이 필요합니다. 로컬 DB 테스트라면 개발 사용자 설정을 확인하세요.");
        if (response.status === 403) throw new Error("로그인한 사용자 정보를 DB에서 확인할 수 없습니다.");
        if (!response.ok) throw new Error(`서버 요청 실패 (${response.status}). 입력값·사진 용량과 서버 상태를 확인하세요.`);
        return response.json();
    }
    async photoData(url) {
        if (!url || url.startsWith("data:")) return url || null;
        const blob = await (await fetch(url)).blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
            reader.readAsDataURL(blob);
        });
    }
    shape(item) {
        const shape = { type: item.type, color: item.color };
        if (item.type === "marker") shape.position = item.overlay.getPosition().toJSON();
        else if (item.type === "circle") {
            shape.position = item.overlay.getCenter().toJSON();
            shape.radius = item.overlay.getRadius();
        } else if (item.type === "rectangle") shape.bounds = item.overlay.getBounds().toJSON();
        else shape.path = item.overlay.getPath().getArray().map((point) => point.toJSON());
        return shape;
    }
    async snapshot(pending) {
        const items = this.draw.items.filter(item => item.registered);
        if (pending) items.push(pending);
        return { features: await Promise.all(items.map(async (item) => ({
            id: item.id, name: item.name, month: item.month, time: item.time,
            visible: item.visible, photo: await this.photoData(item.photoUrl), shape: this.shape(item)
        }))) };
    }
    async save(pending) {
        if (this.busy || !this.loaded) return false;
        if (!pending && (this.draw.vertices.length || this.draw.items.some((item) => !item.registered))) {
            this.status.textContent = "그리기를 완료하고 대기 도형에 이름·월·시간을 지정해 등록한 뒤 저장하세요.";
            return;
        }
        this.setBusy(true);
        this.status.textContent = "레이어를 서버에 저장하는 중…";
        try {
            const document = await this.request("PUT", await this.snapshot(pending));
            const location = window.document.body.dataset.layerStorage === "database" ? "DB에 저장되었습니다. 로그인 없이 저장한 항목은 같은 브라우저에서 복원됩니다." : "서버 메모리에 저장되어 같은 브라우저 세션에서 복원됩니다.";
            this.status.textContent = `나만의 레이어에 항목 ${document.features.length}개 저장 완료. ${location}`;
            return true;
        } catch (error) {
            this.status.textContent = `${error.message} 현재 화면의 내용은 유지됩니다.`;
            return false;
        } finally { this.setBusy(false); }
    }
    restore(document) {
        if (!document || !Array.isArray(document.features)) throw new Error("저장 데이터 형식이 다릅니다. 서버 버전을 확인하세요.");
        this.draw.select(null);
        this.draw.clearPreview();
        this.draw.closeEdit();
        this.draw.items.forEach((item) => {
            item.overlay.setMap(null);
            google.maps.event.clearInstanceListeners(item.overlay);
        });
        this.draw.items.forEach((item) => { if (item.photoUrl) URL.revokeObjectURL(item.photoUrl); });
        this.draw.items = [];
        this.draw.nextId = Math.max(this.draw.nextId, ...document.features.map((item) => item.id)) + 1;
        document.features.forEach((item) => {
            const shape = item.shape;
            const geometry = shape.type === "marker" ? shape.position : shape.type === "circle"
                ? { center: shape.position, radius: shape.radius } : shape.type === "rectangle" ? shape.bounds : shape.path;
            window.document.getElementById("draw-color").value = shape.color;
            this.draw.add(shape.type, geometry, { id: item.id, name: item.name, month: item.month, time: item.time,
                visible: item.visible, photoUrl: item.photo, color: shape.color });
        });
        this.draw.setMode("select");
        this.draw.syncActive();
        this.draw.updateActions();
    }
    async load() {
        if (this.busy) return;
        this.setBusy(true);
        this.status.textContent = "저장된 레이어를 불러오는 중…";
        try {
            const document = await this.request("GET");
            this.restore(document);
            this.loaded = true;
            this.status.textContent = `나만의 레이어에서 항목 ${document.features.length}개를 불러왔습니다. 기존 항목을 수정한 뒤에는 ‘변경사항 저장’을 누르세요.`;
        } catch (error) {
            this.status.textContent = `${error.message} 페이지를 새로고침해 다시 시도하세요.`;
        } finally { this.setBusy(false); }
    }
};
